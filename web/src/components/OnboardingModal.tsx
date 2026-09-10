'use client';

import React, { useState } from 'react';
import { ROLES, RoleId, RoleConfig, applyRoleTheme, setOnboardingCompleted } from '@/lib/roles';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (roleId: RoleId, shouldSeedSample: boolean) => void;
  currentRoleId?: RoleId;
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onSelectRole,
  currentRoleId = 'author-bible',
}: OnboardingModalProps) {
  const [selectedRole, setSelectedRole] = useState<RoleId>(currentRoleId);
  const [seedSampleArticle, setSeedSampleArticle] = useState(true);

  if (!isOpen) return null;

  const roleList: RoleConfig[] = Object.values(ROLES);
  const activeRoleConfig = ROLES[selectedRole];

  const handleRoleClick = (roleId: RoleId) => {
    setSelectedRole(roleId);
    // Apply live theme preview
    applyRoleTheme(roleId);
  };

  const handleConfirm = () => {
    applyRoleTheme(selectedRole);
    setOnboardingCompleted(true);
    onSelectRole(selectedRole, seedSampleArticle);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/80 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 relative">
        {/* Subtle decorative radial gradients */}
        <div
          className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none transition-colors duration-500"
          style={{ background: activeRoleConfig.theme.primary }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500"
          style={{ background: activeRoleConfig.theme.primaryHover }}
        />

        {/* Modal Header */}
        <div className="p-6 sm:p-8 border-b border-slate-800/80 shrink-0 bg-slate-950/40 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🌍</span>
              <span className="text-xs uppercase font-bold tracking-widest text-slate-400">
                Welcome to Gaea-Forge
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Choose Your Creative Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              How will you be using Gaea-Forge? Select your primary role to initialize custom themes,
              tailored naming conventions, and organized categories.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all shadow-sm"
              style={{
                borderColor: activeRoleConfig.theme.primary,
                backgroundColor: activeRoleConfig.theme.primaryLight,
                color: activeRoleConfig.theme.primary,
              }}
            >
              <span>{activeRoleConfig.icon}</span>
              <span>{activeRoleConfig.badge}</span>
            </span>
          </div>
        </div>

        {/* Modal Body: Role Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roleList.map((role) => {
              const isSelected = selectedRole === role.id;
              return (
                <div
                  key={role.id}
                  onClick={() => handleRoleClick(role.id)}
                  className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 relative flex flex-col justify-between group text-left ${
                    isSelected
                      ? 'bg-slate-900/90 shadow-xl scale-[1.01]'
                      : 'bg-slate-950/50 hover:bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                  style={{
                    borderColor: isSelected ? role.theme.primary : undefined,
                    boxShadow: isSelected ? `0 0 25px ${role.theme.accentGlow}` : undefined,
                  }}
                >
                  {/* Selected check pill */}
                  {isSelected && (
                    <div
                      className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-slate-950 font-bold text-xs shadow-md"
                      style={{ backgroundColor: role.theme.primary }}
                    >
                      ✓
                    </div>
                  )}

                  <div>
                    {/* Role Header */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/10"
                        style={{ backgroundColor: role.theme.primaryLight }}
                      >
                        {role.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white group-hover:text-slate-100">
                          {role.title}
                        </h3>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {role.badge}
                        </span>
                      </div>
                    </div>

                    {/* Tagline */}
                    <p className="text-xs text-slate-300 mb-4 line-clamp-2 leading-relaxed">
                      {role.tagline}
                    </p>

                    {/* Category preview chips */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        Default Categories:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {role.categories.slice(0, 4).map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60"
                          >
                            {cat}
                          </span>
                        ))}
                        {role.categories.length > 4 && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-slate-400">
                            +{role.categories.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Theme Accent Footer bar */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <span>Palette:</span>
                      <span
                        className="w-3 h-3 rounded-full inline-block shadow-sm"
                        style={{ backgroundColor: role.theme.primary }}
                      />
                    </span>
                    <span
                      className="font-semibold transition-colors"
                      style={{ color: isSelected ? role.theme.primary : '#94a3b8' }}
                    >
                      {isSelected ? 'Selected Workspace' : 'Click to select'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sample Primer Option */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                id="seed-article-checkbox"
                type="checkbox"
                checked={seedSampleArticle}
                onChange={(e) => setSeedSampleArticle(e.target.checked)}
                className="w-4 h-4 rounded text-gold focus:ring-gold bg-slate-900 border-slate-700 cursor-pointer"
              />
              <label htmlFor="seed-article-checkbox" className="text-xs text-slate-300 cursor-pointer">
                <strong>Include tailored starter guide & sample article</strong> for {activeRoleConfig.shortName}
              </label>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Switch anytime in Settings
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 sm:p-6 border-t border-slate-800/80 bg-slate-950/60 shrink-0 flex items-center justify-between gap-4 relative z-10">
          <p className="text-xs text-slate-400">
            You can customize categories and change roles at any time from the app header.
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 shadow-xl transition-all flex items-center gap-2 hover:opacity-95"
              style={{
                backgroundColor: activeRoleConfig.theme.primary,
                boxShadow: `0 0 20px ${activeRoleConfig.theme.accentGlow}`,
              }}
            >
              <span>🚀 Launch {activeRoleConfig.shortName}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
