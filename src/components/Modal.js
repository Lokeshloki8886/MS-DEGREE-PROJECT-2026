import React from 'react';
import { classNames } from '../lib/ui';

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  panelClassName = ''
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={classNames('modal-panel surface', `modal-panel--${size}`, panelClassName)}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            {description && <p className="modal-copy">{description}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            Close
          </button>
        </div>

        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
