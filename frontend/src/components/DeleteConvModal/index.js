import React from "react";
import { useTranslation } from "react-i18next";
import "../LogoutModal/LogoutModal.css";

export default function DeleteConvModal({ isOpen, onClose, onConfirm, lawyerName }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="lm-overlay" onClick={onClose}>
      <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lm-icon">🗑️</div>
        <h3 className="lm-title">{t("deleteConv.title")}</h3>
        <p className="lm-message">{t("deleteConv.message", { name: lawyerName })}</p>
        <div className="lm-actions">
          <button className="lm-cancel" onClick={onClose}>
            {t("deleteConv.cancel")}
          </button>
          <button className="lm-confirm" onClick={onConfirm}>
            {t("deleteConv.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
