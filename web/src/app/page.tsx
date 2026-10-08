'use client';

import React, { useState, useEffect } from 'react';
import Editor from '@/components/Editor';
import NewArticleModal from '@/components/NewArticleModal';
import NewCanvasModal from '@/components/NewCanvasModal';
import DocumentImportModal from '@/components/DocumentImportModal';
import OnboardingModal from '@/components/OnboardingModal';
import FamilyTreeCanvas from '@/components/FamilyTreeCanvas';
import WorldWebCanvas from '@/components/WorldWebCanvas';
import Sidebar, { ViewMode } from '@/components/Sidebar';
import AppHeader from '@/components/AppHeader';
import EntityInspector from '@/components/EntityInspector';
import NoticeToast from '@/components/NoticeToast';
import { CanvasType, LoreArticle, LoreCategory, WorldSnapshot } from '@/lib/database';
import {
  ROLES,
  RoleId,
  getSavedRole,
  applyRoleTheme,
  hasCompletedOnboarding,
} from '@/lib/roles';
import { WorldBackup, snapshotToBackup } from '@/lib/backup';
import {
  createArticleDraft,
  createRoleSampleArticle,
  filterArticles,
  isCharacterCategory,
  mergeCategories,
} from '@/lib/articles';
import { computeBacklinks, extractLinkedArticleIds, resolveImportedWikiLinks } from '@/lib/links';
import { useNotice } from '@/hooks/useNotice';
import { useWorld } from '@/hooks/useWorld';

export default function Home() {
  const { notice, showNotice } = useNotice();
  const world = useWorld(showNotice);
  const { articles, canvases } = world;

  // Selection & view
  const [activeArticleId, setActiveArticleId] = useState<string>('welcome-gaea-forge');
  const [activeCanvasId, setActiveCanvasId] = useState<string>('canvas-master-web');
  const [activeViewMode, setActiveViewMode] = useState<ViewMode>('editor');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // Role & Workspace Theme State
  const [currentRoleId, setCurrentRoleId] = useState<RoleId>(() => getSavedRole());
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => !hasCompletedOnboarding());
  const activeRoleConfig = ROLES[currentRoleId] || ROLES['author-bible'];
  const categories = activeRoleConfig.categories;
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(categories)
  );

  // Modals & panels
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isNewCanvasModalOpen, setIsNewCanvasModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newModalCategory, setNewModalCategory] = useState<LoreCategory>('Characters');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [snapshots, setSnapshots] = useState<WorldSnapshot[]>([]);

  const activeArticle = articles.find((a) => a.id === activeArticleId) || articles[0];
  const activeCanvas = canvases.find((c) => c.id === activeCanvasId) || canvases[0];

  const filteredArticles = filterArticles(articles, searchQuery, selectedTagFilter);
  const pinnedArticles = filteredArticles.filter((a) => a.isPinned);
  const characterArticles = articles.filter((a) => isCharacterCategory(a.category));
  const displayCategories = mergeCategories(categories, articles);

  // Links between articles
  const linkTargets = articles.map(({ id, title, category }) => ({ id, title, category }));
  const backlinks = activeArticle ? computeBacklinks(articles).get(activeArticle.id) ?? [] : [];
  const outgoingLinks = activeArticle
    ? extractLinkedArticleIds(activeArticle.content)
        .filter((id) => id !== activeArticle.id)
        .map((id) => ({ id, title: articles.find((a) => a.id === id)?.title }))
    : [];

  // Auto-collapse side panels on narrow windows
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1100) setIsInspectorOpen(false);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply active role theme when role changes
  useEffect(() => {
    applyRoleTheme(currentRoleId);
  }, [currentRoleId]);

  // Refresh the snapshot list whenever the import/backup modal opens
  const { loadSnapshots } = world;
  useEffect(() => {
    if (isImportModalOpen) loadSnapshots().then(setSnapshots);
    // loadSnapshots changes identity every render; only re-run when the modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImportModalOpen]);

  const openArticle = (id: string) => {
    setActiveArticleId(id);
    setActiveViewMode('editor');
  };

  const openCanvas = (id: string) => {
    setActiveCanvasId(id);
    setActiveViewMode('canvas');
  };

  const switchRole = (roleId: RoleId) => {
    setCurrentRoleId(roleId);
    setExpandedCategories(new Set(ROLES[roleId].categories));
  };

  const handleSelectRole = (newRoleId: RoleId, shouldSeedSample: boolean) => {
    switchRole(newRoleId);
    applyRoleTheme(newRoleId);
    if (shouldSeedSample) {
      const sample = createRoleSampleArticle(newRoleId);
      world.addArticle(sample);
      setActiveArticleId(sample.id);
    }
  };

  const toggleCategoryExpanded = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // ---- Articles ----

  const handleContentChange = (newContent: string) => {
    if (!activeArticle || activeArticle.content === newContent) return;
    world.updateArticle({ ...activeArticle, content: newContent });
  };

  // Show the folder a new article lands in
  const expandCategory = (category: string) =>
    setExpandedCategories((prev) => (prev.has(category) ? prev : new Set(prev).add(category)));

  const handleCreateArticle = (data: { title: string; category: LoreCategory; tags: string[] }) => {
    const article = createArticleDraft(data);
    world.addArticle(article);
    expandCategory(article.category);
    setActiveArticleId(article.id);
  };

  // Create an article from the editor's [[ picker, in the current article's category
  const handleCreateLinkedArticle = (title: string) => {
    const article = createArticleDraft({
      title,
      category: activeArticle?.category ?? displayCategories[0],
      tags: [],
    });
    world.addArticle(article);
    expandCategory(article.category);
    return article.id;
  };

  const handleDeleteActiveArticle = async () => {
    if (!activeArticle) return;
    if (!window.confirm(`Are you sure you want to delete "${activeArticle.title}"?`)) return;

    const remaining = articles.filter((a) => a.id !== activeArticle.id);
    if (remaining.length > 0) setActiveArticleId(remaining[0].id);
    await world.deleteArticle(activeArticle.id);
  };

  const handleTogglePin = () => {
    if (!activeArticle) return;
    world.updateArticle({ ...activeArticle, isPinned: !activeArticle.isPinned });
  };

  // ---- Canvases ----

  const handleCreateCanvas = (data: { title: string; type: CanvasType }) => {
    openCanvas(world.createCanvas(data).id);
  };

  const handleDeleteCanvas = (canvasId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    const canvas = canvases.find((c) => c.id === canvasId);
    if (!canvas) return;

    if (canvases.length <= 1) {
      alert('You must keep at least one canvas in your world workspace.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete canvas "${canvas.title}"?`)) return;

    if (activeCanvasId === canvasId) {
      setActiveCanvasId(canvases.find((c) => c.id !== canvasId)!.id);
    }
    world.deleteCanvas(canvasId);
  };

  // ---- Import, backup & restore (each returns false if the user cancelled) ----

  const handleImportArticles = async (
    imported: LoreArticle[],
    mode: 'merge' | 'replace'
  ): Promise<boolean> => {
    if (
      mode === 'replace' &&
      !window.confirm(
        `Replace your current world (${articles.length} articles) with ${imported.length} imported articles?\n\nA safety snapshot will be saved first, so you can undo this from Backup & Restore.`
      )
    ) {
      return false;
    }

    // Turn [[Title]] references into links, against existing articles too when merging
    const linked = resolveImportedWikiLinks(imported, mode === 'merge' ? articles : []);
    await world.importArticles(linked, mode, currentRoleId);
    if (imported.length > 0) setActiveArticleId(imported[0].id);
    showNotice('success', `Imported ${imported.length} articles.`);
    return true;
  };

  const restoreBackup = async (backup: WorldBackup, confirmText: string, snapshotReason: string) => {
    if (!window.confirm(confirmText)) return false;

    const restoredCanvases = await world.restoreBackup(backup, snapshotReason, currentRoleId);
    if (backup.articles.length > 0) setActiveArticleId(backup.articles[0].id);
    setActiveCanvasId(restoredCanvases[0].id);
    if (backup.roleId) switchRole(backup.roleId);
    showNotice(
      'success',
      `Restored ${backup.articles.length} articles and ${restoredCanvases.length} canvases.`
    );
    return true;
  };

  const handleRestoreBackup = (backup: WorldBackup) =>
    restoreBackup(
      backup,
      `Restore this backup (${backup.articles.length} articles, ${backup.canvases.length} canvases)? It replaces your current world.\n\nA safety snapshot will be saved first.`,
      `Before restoring backup from ${new Date(backup.exportedAt).toLocaleString()}`
    );

  const handleRestoreSnapshot = (snapshot: WorldSnapshot) =>
    restoreBackup(
      snapshotToBackup(snapshot),
      `Restore the snapshot "${snapshot.reason}"? It replaces your current world.\n\nA new safety snapshot of the current world will be saved first.`,
      `Before restoring snapshot from ${new Date(snapshot.createdAt).toLocaleString()}`
    );

  return (
    <div className="flex h-screen w-full bg-slate-950 text-parchment overflow-hidden select-none font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenImport={() => setIsImportModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTagFilter={selectedTagFilter}
        onClearTagFilter={() => setSelectedTagFilter(null)}
        canvases={canvases}
        activeCanvasId={activeCanvasId}
        activeArticleId={activeArticleId}
        activeViewMode={activeViewMode}
        onSelectCanvas={openCanvas}
        onSelectArticle={openArticle}
        onNewCanvas={() => setIsNewCanvasModalOpen(true)}
        onDeleteCanvas={handleDeleteCanvas}
        pinnedArticles={pinnedArticles}
        filteredArticles={filteredArticles}
        displayCategories={displayCategories}
        expandedCategories={expandedCategories}
        onToggleCategory={toggleCategoryExpanded}
        onExpandedChange={setExpandedCategories}
        onNewArticle={(category) => {
          setNewModalCategory(category);
          setIsNewModalOpen(true);
        }}
        codexTitle={activeRoleConfig.terminology.codexTitle}
        newArticleLabel={activeRoleConfig.terminology.newArticleButton}
      />

      {/* MAIN CONTENT AREA: Navbar Mode Switcher & Workspace */}
      <main className="flex-1 flex flex-col bg-[#0b1120] relative overflow-hidden min-w-0">
        <AppHeader
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          activeViewMode={activeViewMode}
          onViewModeChange={setActiveViewMode}
          activeCanvas={activeCanvas}
          activeArticle={activeArticle}
          activeRoleConfig={activeRoleConfig}
          onOpenRolePicker={() => setIsOnboardingOpen(true)}
          saveStatus={world.saveStatus}
          saveError={world.saveError}
          onRetrySave={() => world.flushSaves()}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
          onTogglePin={handleTogglePin}
          canDeleteCanvas={canvases.length > 1}
          onDeleteCanvas={() => handleDeleteCanvas(activeCanvas.id)}
        />

        {/* Canvas or Editor Workspace */}
        <div className="flex-1 overflow-hidden relative min-w-0">
          {activeViewMode === 'editor' ? (
            <div className="w-full h-full p-2 sm:p-4 md:p-6 min-w-0 flex flex-col">
              {activeArticle ? (
                <Editor
                  key={activeArticle.id}
                  content={activeArticle.content}
                  onChange={handleContentChange}
                  linkTargets={linkTargets}
                  onOpenArticle={openArticle}
                  onCreateLinkedArticle={handleCreateLinkedArticle}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  Select or create an article to begin lore editing.
                </div>
              )}
            </div>
          ) : activeCanvas.type === 'world-web' ? (
            <WorldWebCanvas
              key={activeCanvas.id}
              canvasData={activeCanvas}
              onChange={world.updateCanvas}
              articles={articles}
              onOpenArticle={openArticle}
            />
          ) : (
            <FamilyTreeCanvas
              key={activeCanvas.id}
              canvasData={activeCanvas}
              onChange={world.updateCanvas}
              characterArticles={characterArticles}
            />
          )}
        </div>
      </main>

      {/* RIGHT SIDEBAR: Entity Metadata Inspector (Visible in Editor mode) */}
      {activeViewMode === 'editor' && (
        <EntityInspector
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          article={activeArticle}
          categories={displayCategories}
          onUpdate={world.updateArticle}
          onDelete={handleDeleteActiveArticle}
          onTagClick={setSelectedTagFilter}
          backlinks={backlinks}
          outgoingLinks={outgoingLinks}
          onOpenArticle={openArticle}
        />
      )}

      {/* MODALS */}
      <NewArticleModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateArticle}
        defaultCategory={newModalCategory}
        categories={displayCategories}
      />

      <NewCanvasModal
        isOpen={isNewCanvasModalOpen}
        onClose={() => setIsNewCanvasModalOpen(false)}
        onCreate={handleCreateCanvas}
      />

      <DocumentImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        articleCount={articles.length}
        canvasCount={canvases.length}
        activeRole={currentRoleId}
        categories={displayCategories}
        snapshots={snapshots}
        onImportArticles={handleImportArticles}
        onRestoreBackup={handleRestoreBackup}
        onRestoreSnapshot={handleRestoreSnapshot}
        onExportBackup={() => world.exportBackup(currentRoleId)}
      />

      <NoticeToast notice={notice} />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSelectRole={handleSelectRole}
        currentRoleId={currentRoleId}
      />
    </div>
  );
}
