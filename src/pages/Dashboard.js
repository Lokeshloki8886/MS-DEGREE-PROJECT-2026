import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard({ username, onLogout }) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await axios.post('/api/logout');
        onLogout();
        navigate('/login');
    };

    return (
        <div className="dashboard">
            <nav className="navbar">
                <h1>Split & Settle</h1>
                <div className="nav-right">
                    <span>Hi, {username}</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </nav>
            <div className="dashboard-content">
                <h2>Your Groups</h2>
                <p className="placeholder-text">No groups yet. Create one to get started!</p>
            </div>
        </div>
    );
}

export default Dashboard;
