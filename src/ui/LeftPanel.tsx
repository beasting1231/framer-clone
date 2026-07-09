import { useEditor } from "@/store/editor";
import { PagesTab } from "./panels/PagesTab";
import { LayersTab } from "./panels/LayersTab";
import { AssetsTab } from "./panels/AssetsTab";
import { CmsTab } from "./panels/CmsTab";
import { InsertTab } from "./panels/InsertTab";
import type { LeftTab } from "@/store/editor";

const TABS: { id: LeftTab; label: string }[] = [
  { id: "pages", label: "Pages" },
  { id: "layers", label: "Layers" },
  { id: "assets", label: "Assets" },
  { id: "cms", label: "CMS" },
];

export function LeftPanel() {
  const leftTab = useEditor((s) => s.leftTab);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const assetPick = useEditor((s) => s.assetPick);
  const pickingAssets = assetPick != null;

  return (
    <div className={`left-panel ${pickingAssets ? "picking-asset" : ""}`}>
      <div className="panel-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`panel-tab ${leftTab === tab.id ? "active" : ""} ${tab.id === "assets" && pickingAssets ? "pick-highlight" : ""}`}
            onClick={() => setLeftTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button className={`panel-tab ${leftTab === "insert" ? "active" : ""}`} onClick={() => setLeftTab("insert")}>
          Insert
        </button>
      </div>
      {leftTab === "pages" && <PagesTab />}
      {leftTab === "layers" && <LayersTab />}
      {leftTab === "assets" && <AssetsTab />}
      {leftTab === "cms" && <CmsTab />}
      {leftTab === "insert" && <InsertTab />}
    </div>
  );
}
