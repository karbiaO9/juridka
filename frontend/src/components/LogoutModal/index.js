import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import "./LogoutModal.css";

export default function LogoutModal({ isOpen, onClose }) {
  const { t }      = useTranslation();
  const { logout } = useAuth();
  const navigate   = useNavigate();

  if (!isOpen) return null;

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate("/login", { replace: true });
  };

  return (
    <div className="lm-overlay" onClick={onClose}>
      <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lm-icon">🔐</div>
        <h3 className="lm-title">{t("logout.title", { defaultValue: "Déconnexion" })}</h3>
        <p className="lm-message">{t("logout.message", { defaultValue: "Êtes-vous sûr de vouloir vous déconnecter ?" })}</p>
        <div className="lm-actions">
          <button className="lm-cancel" onClick={onClose}>
            {t("logout.cancel", { defaultValue: "Annuler" })}
          </button>
          <button className="lm-confirm" onClick={handleLogout}>
            {t("logout.confirm", { defaultValue: "Se déconnecter" })}
          </button>
        </div>
      </div>
    </div>
  );
}