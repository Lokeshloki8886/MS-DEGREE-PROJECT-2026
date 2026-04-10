from flask import Flask, request, jsonify, session
from flask_cors import CORS
import mysql.connector
import bcrypt
from datetime import date, timedelta

app = Flask(__name__)
app.secret_key = 'splitwise-secret-key-2026'

CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

db_config = {
    'host': 'localhost',
    'user': 'root',
    'password':'Lokesh@7115',
    'database': 'splitwise'
}

EXPENSE_CATEGORIES = [
    'Food',
    'Travel',
    'Shopping',
    'Rent',
    'Bills',
    'Entertainment',
    'Other'
]


def get_db():
    conn = mysql.connector.connect(**db_config)
    return conn


@app.route('/api/check-username', methods=['GET'])
def check_username():
    name = request.args.get('username', '').strip()
    if len(name) < 1:
        return jsonify({'available': False}), 200
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id FROM users WHERE username = %s", (name,))
    taken = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify({'available': taken is None}), 200


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, hashed.decode('utf-8')))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'User registered successfully'}), 201
    except mysql.connector.IntegrityError:
        return jsonify({'error': 'Username already taken'}), 409
    except Exception as e:
        return jsonify({'error': 'Something went wrong'}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'message': 'Logged in', 'username': user['username']}), 200
    else:
        return jsonify({'error': 'Invalid username or password'}), 401


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'}), 200


@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' in session:
        return jsonify({'user_id': session['user_id'], 'username': session['username']}), 200
    else:
        return jsonify({'error': 'Not logged in'}), 401


@app.route('/api/groups', methods=['POST'])
def create_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')

    if not name:
        return jsonify({'error': 'Group name is required'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO `groups` (name, description, created_by) VALUES (%s, %s, %s)",
        (name, description, session['user_id'])
    )
    group_id = cur.lastrowid
    cur.execute(
        "INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)",
        (group_id, session['user_id'])
    )
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Group created', 'group_id': group_id}), 201


@app.route('/api/groups', methods=['GET'])
def get_groups():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT g.id, g.name, g.description, g.created_at,
               (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
        FROM `groups` g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = %s
        ORDER BY g.created_at DESC
    """, (session['user_id'],))
    groups = cur.fetchall()
    cur.close()
    conn.close()

    for g in groups:
        if g['created_at']:
            g['created_at'] = str(g['created_at'])

    return jsonify({'groups': groups}), 200


@app.route('/api/dashboard-summary', methods=['GET'])
def get_dashboard_summary():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    user_id = session['user_id']
    today = date.today()
    start_day = today - timedelta(days=6)
    day_order = []
    day_totals = {}

    for i in range(7):
        current_day = start_day + timedelta(days=i)
        key = current_day.isoformat()
        day_order.append(key)
        day_totals[key] = 0.0

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT e.amount, DATE(e.created_at) as day
        FROM expenses e
        JOIN group_members gm ON gm.group_id = e.group_id
        WHERE gm.user_id = %s
          AND e.paid_by = %s
          AND DATE(e.created_at) >= %s
        ORDER BY e.created_at ASC
    """, (user_id, user_id, start_day))
    spent_rows = cur.fetchall()

    cur.execute("""
        SELECT COALESCE(SUM(e.amount), 0) as total
        FROM expenses e
        JOIN group_members gm ON gm.group_id = e.group_id
        WHERE gm.user_id = %s
          AND e.paid_by = %s
    """, (user_id, user_id))
    total_spent = float(cur.fetchone()['total'] or 0)

    cur.execute("""
        SELECT COUNT(DISTINCT gm.group_id) as total
        FROM group_members gm
        WHERE gm.user_id = %s
    """, (user_id,))
    total_groups = int(cur.fetchone()['total'] or 0)

    cur.execute("""
        SELECT COUNT(*) as total
        FROM expenses e
        JOIN group_members gm ON gm.group_id = e.group_id
        WHERE gm.user_id = %s
          AND e.paid_by = %s
    """, (user_id, user_id))
    total_expenses = int(cur.fetchone()['total'] or 0)

    cur.close()
    conn.close()

    for row in spent_rows:
        day_value = row['day'].isoformat() if row['day'] else None
        if day_value in day_totals:
            day_totals[day_value] += float(row['amount'])

    spending_by_day = []
    for key in day_order:
        current_day = date.fromisoformat(key)
        spending_by_day.append({
            'date': key,
            'label': current_day.strftime('%a'),
            'amount': round(day_totals[key], 2)
        })

    return jsonify({
        'summary': {
            'total_spent': round(total_spent, 2),
            'total_groups': total_groups,
            'total_expenses': total_expenses,
            'spending_by_day': spending_by_day
        }
    }), 200


@app.route('/api/groups/<int:group_id>', methods=['GET'])
def get_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    cur.execute("""
        SELECT g.id, g.name, g.description, g.created_at, g.created_by as created_by_id, u.username as created_by
        FROM `groups` g
        JOIN users u ON g.created_by = u.id
        WHERE g.id = %s
    """, (group_id,))
    group = cur.fetchone()

    if not group:
        cur.close()
        conn.close()
        return jsonify({'error': 'Group not found'}), 404

    cur.execute("""
        SELECT u.id, u.username, gm.joined_at
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = %s
    """, (group_id,))
    members = cur.fetchall()

    cur.close()
    conn.close()

    group['created_at'] = str(group['created_at'])
    for m in members:
        if m['joined_at']:
            m['joined_at'] = str(m['joined_at'])

    return jsonify({'group': group, 'members': members}), 200


@app.route('/api/groups/<int:group_id>/members', methods=['POST'])
def add_member(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json()
    username = data.get('username')

    if not username:
        return jsonify({'error': 'Username is required'}), 400

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    cur.execute("SELECT id FROM users WHERE username = %s", (username,))
    target = cur.fetchone()
    if not target:
        cur.close()
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, target['id'])
    )
    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'User is already a member'}), 409

    cur.execute(
        "INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)",
        (group_id, target['id'])
    )
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Member added'}), 201


@app.route('/api/groups/<int:group_id>/members/<int:user_id>', methods=['DELETE'])
def remove_member(group_id, user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute("SELECT created_by FROM `groups` WHERE id = %s", (group_id,))
    grp = cur.fetchone()
    if not grp:
        cur.close()
        conn.close()
        return jsonify({'error': 'Group not found'}), 404

    if grp['created_by'] != session['user_id']:
        cur.close()
        conn.close()
        return jsonify({'error': 'Only the group owner can remove members'}), 403

    if user_id == session['user_id']:
        cur.close()
        conn.close()
        return jsonify({'error': 'Owner cannot remove themselves'}), 400

    cur.execute(
        "DELETE FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id)
    )
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Member removed'}), 200


@app.route('/api/groups/<int:group_id>/leave', methods=['POST'])
def leave_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute("SELECT created_by FROM `groups` WHERE id = %s", (group_id,))
    grp = cur.fetchone()
    if not grp:
        cur.close()
        conn.close()
        return jsonify({'error': 'Group not found'}), 404

    if grp['created_by'] == session['user_id']:
        cur.close()
        conn.close()
        return jsonify({'error': 'Owner cannot leave the group. Delete it instead.'}), 400

    cur.execute(
        "DELETE FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'You left the group'}), 200


@app.route('/api/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute("SELECT created_by FROM `groups` WHERE id = %s", (group_id,))
    grp = cur.fetchone()
    if not grp:
        cur.close()
        conn.close()
        return jsonify({'error': 'Group not found'}), 404

    if grp['created_by'] != session['user_id']:
        cur.close()
        conn.close()
        return jsonify({'error': 'Only the group owner can delete this group'}), 403

    cur.execute("DELETE FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = %s)", (group_id,))
    cur.execute("DELETE FROM expenses WHERE group_id = %s", (group_id,))
    cur.execute("DELETE FROM settlements WHERE group_id = %s", (group_id,))
    cur.execute("DELETE FROM group_members WHERE group_id = %s", (group_id,))
    cur.execute("DELETE FROM `groups` WHERE id = %s", (group_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Group deleted'}), 200


@app.route('/api/groups/<int:group_id>/expenses', methods=['POST'])
def add_expense(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json()
    description = data.get('description', '')
    category = data.get('category') or 'Other'
    amount = data.get('amount')
    paid_by = data.get('paid_by')
    split_among = data.get('split_among', [])

    if not amount or not paid_by or len(split_among) == 0:
        return jsonify({'error': 'Amount, paid_by, and split_among are required'}), 400

    try:
        amount = round(float(amount), 2)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount'}), 400

    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than zero'}), 400

    if category not in EXPENSE_CATEGORIES:
        return jsonify({'error': 'Invalid category'}), 400

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, paid_by)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Payer is not a member of this group'}), 400

    for member_id in split_among:
        cur.execute(
            "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
            (group_id, member_id)
        )
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'One of the split members is not in this group'}), 400

    cur.execute(
        "INSERT INTO expenses (group_id, paid_by, amount, description, category) VALUES (%s, %s, %s, %s, %s)",
        (group_id, paid_by, amount, description, category)
    )
    expense_id = cur.lastrowid

    split_amount = round(amount / len(split_among), 2)
    for member_id in split_among:
        cur.execute(
            "INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (%s, %s, %s)",
            (expense_id, member_id, split_amount)
        )

    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Expense added', 'expense_id': expense_id}), 201


@app.route('/api/groups/<int:group_id>/expenses', methods=['GET'])
def get_expenses(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    cur.execute("""
        SELECT e.id, e.description, e.category, e.amount, e.created_at, e.paid_by as paid_by_id, u.username as paid_by
        FROM expenses e
        JOIN users u ON e.paid_by = u.id
        WHERE e.group_id = %s
        ORDER BY e.created_at DESC
    """, (group_id,))
    expenses = cur.fetchall()

    for expense in expenses:
        expense['category'] = expense.get('category') or 'Other'
        expense['amount'] = float(expense['amount'])
        if expense['created_at']:
            expense['created_at'] = str(expense['created_at'])

        cur.execute("""
            SELECT es.user_id, es.amount, u.username
            FROM expense_splits es
            JOIN users u ON es.user_id = u.id
            WHERE es.expense_id = %s
        """, (expense['id'],))
        splits = cur.fetchall()
        for s in splits:
            s['amount'] = float(s['amount'])
        expense['splits'] = splits

    cur.close()
    conn.close()
    return jsonify({'expenses': expenses}), 200


@app.route('/api/groups/<int:group_id>/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(group_id, expense_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    cur.execute(
        "SELECT id, paid_by FROM expenses WHERE id = %s AND group_id = %s",
        (expense_id, group_id)
    )
    expense = cur.fetchone()
    if not expense:
        cur.close()
        conn.close()
        return jsonify({'error': 'Expense not found'}), 404

    if expense['paid_by'] != session['user_id']:
        cur.close()
        conn.close()
        return jsonify({'error': 'Only the person who paid can delete this expense'}), 403

    cur.execute("DELETE FROM expense_splits WHERE expense_id = %s", (expense_id,))
    cur.execute("DELETE FROM expenses WHERE id = %s", (expense_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Expense deleted'}), 200


@app.route('/api/groups/<int:group_id>/balances', methods=['GET'])
def get_balances(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    cur.execute("""
        SELECT e.id, e.paid_by, e.amount
        FROM expenses e
        WHERE e.group_id = %s
    """, (group_id,))
    all_expenses = cur.fetchall()

    debts = {}

    for expense in all_expenses:
        payer_id = expense['paid_by']
        total = float(expense['amount'])

        cur.execute("""
            SELECT user_id, amount FROM expense_splits WHERE expense_id = %s
        """, (expense['id'],))
        splits = cur.fetchall()

        for split in splits:
            borrower_id = split['user_id']
            share = float(split['amount'])
            if borrower_id == payer_id:
                continue
            pair = (borrower_id, payer_id)
            reverse = (payer_id, borrower_id)
            if reverse in debts:
                debts[reverse] -= share
            else:
                debts[pair] = debts.get(pair, 0) + share

    user_map = {}
    cur.execute("""
        SELECT u.id, u.username FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = %s
    """, (group_id,))
    for row in cur.fetchall():
        user_map[row['id']] = row['username']

    cur.close()
    conn.close()

    balances = []
    for (from_id, to_id), amount in debts.items():
        if round(amount, 2) == 0:
            continue
        if amount > 0:
            balances.append({
                'from': user_map.get(from_id, 'Unknown'),
                'to': user_map.get(to_id, 'Unknown'),
                'amount': round(amount, 2)
            })
        else:
            balances.append({
                'from': user_map.get(to_id, 'Unknown'),
                'to': user_map.get(from_id, 'Unknown'),
                'amount': round(abs(amount), 2)
            })

    return jsonify({'balances': balances}), 200


@app.route('/api/groups/<int:group_id>/simplified-debts', methods=['GET'])
def get_simplified_debts(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    # get all members
    cur.execute("""
        SELECT u.id, u.username FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = %s
    """, (group_id,))
    member_rows = cur.fetchall()
    user_map = {}
    for row in member_rows:
        user_map[row['id']] = row['username']

    # calculate net balance for each member
    net = {}
    for uid in user_map:
        net[uid] = 0.0

    cur.execute("""
        SELECT e.id, e.paid_by, e.amount FROM expenses e WHERE e.group_id = %s
    """, (group_id,))
    all_expenses = cur.fetchall()

    for expense in all_expenses:
        payer = expense['paid_by']
        total = float(expense['amount'])

        cur.execute("SELECT user_id, amount FROM expense_splits WHERE expense_id = %s", (expense['id'],))
        splits = cur.fetchall()

        for split in splits:
            share = float(split['amount'])
            net[payer] = net.get(payer, 0) + share
            net[split['user_id']] = net.get(split['user_id'], 0) - share

    # subtract already settled amounts
    cur.execute("""
        SELECT from_user, to_user, amount FROM settlements
        WHERE group_id = %s AND settled = TRUE
    """, (group_id,))
    for s in cur.fetchall():
        amt = float(s['amount'])
        net[s['from_user']] = net.get(s['from_user'], 0) + amt
        net[s['to_user']] = net.get(s['to_user'], 0) - amt

    cur.close()
    conn.close()

    # greedy algorithm to minimize transactions
    creditors = []
    debtors = []
    for uid, balance in net.items():
        rounded = round(balance, 2)
        if rounded > 0:
            creditors.append([uid, rounded])
        elif rounded < 0:
            debtors.append([uid, abs(rounded)])

    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    payments = []
    i = 0
    j = 0
    while i < len(debtors) and j < len(creditors):
        debtor_id = debtors[i][0]
        creditor_id = creditors[j][0]
        settle_amount = min(debtors[i][1], creditors[j][1])

        if round(settle_amount, 2) > 0:
            payments.append({
                'from_user': debtor_id,
                'from_username': user_map.get(debtor_id, 'Unknown'),
                'to_user': creditor_id,
                'to_username': user_map.get(creditor_id, 'Unknown'),
                'amount': round(settle_amount, 2)
            })

        debtors[i][1] -= settle_amount
        creditors[j][1] -= settle_amount

        if round(debtors[i][1], 2) <= 0:
            i += 1
        if round(creditors[j][1], 2) <= 0:
            j += 1

    return jsonify({'debts': payments}), 200


@app.route('/api/groups/<int:group_id>/settle', methods=['POST'])
def settle_debt(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json()
    from_user = data.get('from_user')
    to_user = data.get('to_user')
    amount = data.get('amount')

    if not from_user or not to_user or not amount:
        return jsonify({'error': 'from_user, to_user, and amount are required'}), 400

    try:
        amount = round(float(amount), 2)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount'}), 400

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    cur.execute(
        "INSERT INTO settlements (group_id, from_user, to_user, amount, settled) VALUES (%s, %s, %s, %s, TRUE)",
        (group_id, from_user, to_user, amount)
    )
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Settled'}), 201


@app.route('/api/groups/<int:group_id>/settlements', methods=['GET'])
def get_settlements(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT id FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, session['user_id'])
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'Not a member of this group'}), 403

    cur.execute("""
        SELECT s.id, s.amount, s.created_at,
               u1.username as from_username, u2.username as to_username
        FROM settlements s
        JOIN users u1 ON s.from_user = u1.id
        JOIN users u2 ON s.to_user = u2.id
        WHERE s.group_id = %s AND s.settled = TRUE
        ORDER BY s.created_at DESC
    """, (group_id,))
    rows = cur.fetchall()

    for row in rows:
        row['amount'] = float(row['amount'])
        if row['created_at']:
            row['created_at'] = str(row['created_at'])

    cur.close()
    conn.close()
    return jsonify({'settlements': rows}), 200


@app.route('/api/users/search', methods=['GET'])
def search_users():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    query = request.args.get('q', '').strip()
    if len(query) < 1:
        return jsonify({'users': []}), 200

    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT id, username FROM users WHERE username LIKE %s AND id != %s LIMIT 8",
        (query + '%', session['user_id'])
    )
    results = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify({'users': results}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)
