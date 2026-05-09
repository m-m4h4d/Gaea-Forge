import Editor from '@/components/Editor';

export default function Home() {
  return (
    <div className="flex h-screen w-full bg-slate-900 text-parchment overflow-hidden">
      {/* Left Sidebar: Navigation & Categories */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col shadow-xl z-10">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-wider text-gold">Gaea-Forge</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <nav className="space-y-2 text-sm">
            <div>
              <div className="font-semibold text-slate-400 uppercase text-xs mb-2 tracking-wider">World Lore</div>
              <ul className="space-y-1 pl-2 border-l border-slate-700">
                <li>
                  <a href="#" className="block py-1 px-2 hover:bg-slate-800 rounded text-parchment-muted hover:text-gold transition-colors">
                    Kingdoms & Empires
                  </a>
                </li>
                <li>
                  <a href="#" className="block py-1 px-2 hover:bg-slate-800 rounded text-parchment-muted hover:text-gold transition-colors">
                    Magic Systems
                  </a>
                </li>
                <li>
                  <a href="#" className="block py-1 px-2 hover:bg-slate-800 rounded text-gold bg-slate-800/50 transition-colors">
                    Characters
                  </a>
                </li>
              </ul>
            </div>
            <div className="pt-4">
              <div className="font-semibold text-slate-400 uppercase text-xs mb-2 tracking-wider">Campaigns</div>
              <ul className="space-y-1 pl-2 border-l border-slate-700">
                <li>
                  <a href="#" className="block py-1 px-2 hover:bg-slate-800 rounded text-parchment-muted hover:text-gold transition-colors">
                    The Shattered Crown
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
          Sync Status: <span className="text-emerald-500">Online</span>
        </div>
      </aside>

      {/* Main Content Area: Editor */}
      <main className="flex-1 flex flex-col bg-[#0b1120] relative">
        <header className="h-14 border-b border-slate-800 flex items-center px-6 justify-between shrink-0 bg-slate-900/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>World Lore</span>
            <span>/</span>
            <span>Characters</span>
            <span>/</span>
            <span className="text-parchment">Elora of the Wilds</span>
          </div>
          <button className="px-4 py-1.5 bg-gold text-slate-900 rounded font-semibold text-sm hover:bg-gold-hover transition-colors shadow-lg shadow-gold/20">
            Save
          </button>
        </header>
        
        <div className="flex-1 p-6 overflow-hidden">
          <Editor />
        </div>
      </main>

      {/* Right Sidebar: Quick Info / Metadata */}
      <aside className="w-72 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col shadow-xl z-10">
        <div className="p-4 border-b border-slate-800">
          <h2 className="font-semibold text-gold tracking-wide">Quick Info</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm custom-scrollbar">
          
          <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-parchment-muted hover:border-gold cursor-pointer transition-colors">hero</span>
              <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-parchment-muted hover:border-gold cursor-pointer transition-colors">druid</span>
              <span className="px-2 py-1 border border-dashed border-slate-600 rounded text-xs text-slate-500 hover:text-gold hover:border-gold cursor-pointer transition-colors">+ Add Tag</span>
            </div>
          </div>

          <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Properties</h3>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-500">Status</span>
                <span className="text-emerald-400">Alive</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-500">Location</span>
                <span className="text-parchment-muted">Whispering Woods</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-500">Affiliation</span>
                <span className="text-parchment-muted">Circle of Thorns</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Media</h3>
            <div className="aspect-square bg-slate-800 rounded flex items-center justify-center border border-slate-700 hover:border-gold cursor-pointer transition-colors group relative overflow-hidden">
              <span className="text-slate-500 group-hover:text-gold transition-colors z-10">Upload Image</span>
            </div>
          </div>

        </div>
      </aside>
    </div>
  );
}
