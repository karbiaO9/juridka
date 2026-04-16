import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./RoleSelector.css";
import Logo from "../../components/Logo";
import { useNavigate } from "react-router-dom";

export default function RoleSelector({ onSelect }) {
    const { t } = useTranslation();
    const [hovered, setHovered] = useState(null);
    const navigate = useNavigate();

    const handleSelect = (key) => {
        onSelect && onSelect(key);
        navigate(`/signup/${key}`);
    };
    const roles = [
        {
            key: "avocat",
            icon: "⚖️",
            label: t("roleSelector.avocat.label"),
            subtitle: t("roleSelector.avocat.subtitle"),
            badge: t("roleSelector.avocat.badge"),
            description: t("roleSelector.avocat.description"),
            features: [
                t("roleSelector.avocat.feature1"),
                t("roleSelector.avocat.feature2"),
                t("roleSelector.avocat.feature3"),
            ],
            accentClass: "accent-gold",
            steps: 9,
        },
        {
            key: "client",
            icon: "👤",
            label: t("roleSelector.client.label"),
            subtitle: t("roleSelector.client.subtitle"),
            badge: t("roleSelector.client.badge"),
            description: t("roleSelector.client.description"),
            features: [
                t("roleSelector.client.feature1"),
                t("roleSelector.client.feature2"),
                t("roleSelector.client.feature3"),
            ],
            accentClass: "accent-blue",
            steps: 6,
        },
    ];

    return (
        <div className="rs-page">
            {/* Navbar */}
            <nav className="rs-nav">
                <div className="rs-logo">
                    <Logo />
                </div>
                <a href="/login" className="rs-login-link">
                    {t("roleSelector.nav.alreadyMember")}{" "}
                    <span>{t("roleSelector.nav.login")}</span>
                </a>
            </nav>

            {/* Background decorations */}
            <div className="rs-bg-orb rs-orb-1" />
            <div className="rs-bg-orb rs-orb-2" />
            <div className="rs-bg-grid" />

            {/* Main content */}
            <main className="rs-main">
                <div className="rs-header">
                    <div className="rs-eyebrow">{t("roleSelector.header.eyebrow")}</div>
                    <h1 className="rs-title">
                        {t("roleSelector.header.title")}
                        <br />
                        <em>{t("roleSelector.header.titleItalic")}</em>
                    </h1>
                    <p className="rs-subtitle">{t("roleSelector.header.subtitle")}</p>
                </div>

                {/* Cards */}
                <div className="rs-cards">
                    {roles.map((role, i) => (
                        <div
                            key={role.key}
                            className={`rs-card rs-card--${role.key} ${hovered === role.key ? "rs-card--hovered" : ""
                                }`}
                            style={{ animationDelay: `${i * 0.12}s` }}
                            onMouseEnter={() => setHovered(role.key)}
                            onMouseLeave={() => setHovered(null)}
                            onClick={() => handleSelect(role.key)}                        >
                            <div className="rs-card-glow" />

                            {/* Top */}
                            <div className="rs-card-top">
                                <div className={`rs-icon-wrap ${role.accentClass}`}>
                                    <span className="rs-icon">{role.icon}</span>
                                </div>
                                <div className={`rs-badge ${role.accentClass}`}>
                                    {role.badge}
                                </div>
                            </div>

                            {/* Title */}
                            <div className="rs-card-title-wrap">
                                <h2 className="rs-card-title">{role.label}</h2>
                                <p className="rs-card-subtitle">{role.subtitle}</p>
                            </div>

                            {/* Description */}
                            <p className="rs-card-desc">{role.description}</p>

                            {/* Features */}
                            <ul className="rs-features">
                                {role.features.map((f) => (
                                    <li key={f} className={`rs-feature ${role.accentClass}`}>
                                        <span className="rs-feature-dot" />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* Footer */}
                            <div className="rs-card-footer">
                                <span className="rs-steps-info">
                                    {t("roleSelector.card.stepsInfo", { count: role.steps })}
                                </span>
                                <button className={`rs-cta ${role.accentClass}`}>
                                    {t("roleSelector.card.cta")}
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path
                                            d="M3 8h10M9 4l4 4-4 4"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className={`rs-corner-deco ${role.accentClass}`} />
                        </div>
                    ))}
                </div>

                {/* Bottom note */}
                <p className="rs-bottom-note">
                    {t("roleSelector.footer.privacyNote")}
                    <span className="rs-lock">🔒</span>
                </p>
            </main>
        </div>
    );
}