import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { AssetList } from './components/AssetList';
import { AssetModal } from './components/AssetModal';
import { DepreciationScheduleModal } from './components/DepreciationScheduleModal';
import { DisposalModal } from './components/DisposalModal';
import { ImportModal } from './components/ImportModal';
import { ReportsView } from './components/ReportsView';
import { DisposalsView } from './components/DisposalsView';
import { DepreciationCalculatorWidget } from './components/DepreciationCalculatorWidget';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { StandaloneExeModal } from './components/StandaloneExeModal';
import { Asset, AssetCategory, AssetDisposal, CompanySettings } from './types/asset';
import { 
  getStoredAssets, 
  getStoredCategories, 
  getStoredSettings, 
  saveStoredAssets,
  saveStoredSettings,
  loadDemoDataset
} from './utils/storage';
import { exportAssetsToExcel } from './utils/excel';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(getStoredSettings());
  const [activeTab, setActiveTab] = useState<'assets' | 'calculator' | 'reports' | 'disposals' | 'backup'>('assets');

  // Modals state
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [scheduleModalAsset, setScheduleModalAsset] = useState<Asset | null>(null);
  const [disposalModalAsset, setDisposalModalAsset] = useState<Asset | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isExeInfoModalOpen, setIsExeInfoModalOpen] = useState(false);

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load initial data
  const refreshData = () => {
    setAssets(getStoredAssets());
    setCategories(getStoredCategories());
    setSettings(getStoredSettings());
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Save assets on change
  const handleUpdateAssets = (newAssets: Asset[]) => {
    setAssets(newAssets);
    saveStoredAssets(newAssets);
  };

  // Add or edit asset
  const handleSaveAsset = (assetData: Asset) => {
    const existingIndex = assets.findIndex((a) => a.id === assetData.id);
    let updated: Asset[];
    if (existingIndex >= 0) {
      updated = [...assets];
      updated[existingIndex] = assetData;
      showToast(`تم تحديث بيانات الأصل "${assetData.name}" بنجاح.`);
    } else {
      updated = [assetData, ...assets];
      showToast(`تمت إضافة الأصل "${assetData.name}" وحساب الإهلاك بنجاح.`);
    }
    handleUpdateAssets(updated);
    setEditingAsset(null);
  };

  // Delete asset
  const handleDeleteAsset = (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    if (window.confirm(`هل أنت متأكد من حذف الأصل "${asset.name}" (${asset.code}) نهائياً؟`)) {
      const updated = assets.filter((a) => a.id !== id);
      handleUpdateAssets(updated);
      showToast(`تم حذف الأصل "${asset.name}" بنجاح.`, 'info');
    }
  };

  // Asset disposal confirmation
  const handleConfirmDisposal = (assetId: string, disposal: AssetDisposal) => {
    const updated = assets.map((a) => {
      if (a.id === assetId) {
        return {
          ...a,
          status: 'disposed' as const,
          disposal,
          updatedAt: new Date().toISOString(),
        };
      }
      return a;
    });
    handleUpdateAssets(updated);
    showToast('تم تسجيل استبعاد الأصل وحساب الأرباح/الخسائر الرأسمالية بنجاح.');
  };

  // Restore disposed asset
  const handleRestoreAsset = (assetId: string) => {
    const updated = assets.map((a) => {
      if (a.id === assetId) {
        return {
          ...a,
          status: 'active' as const,
          disposal: undefined,
          updatedAt: new Date().toISOString(),
        };
      }
      return a;
    });
    handleUpdateAssets(updated);
    showToast('تمت استعادة الأصل وإلغاء الاستبعاد بنجاح.');
  };

  // Import completion handler
  const handleImportComplete = (importedAssets: Asset[], mode: 'append' | 'replace') => {
    let updated: Asset[];
    if (mode === 'replace') {
      updated = importedAssets;
    } else {
      // Append mode: avoid duplicating codes if possible
      updated = [...importedAssets, ...assets];
    }
    handleUpdateAssets(updated);
    showToast(`تم استيراد ${importedAssets.length} أصل بنجاح إلى قاعدة البيانات المحلية.`);
  };

  // Change currency handler
  const handleChangeCurrency = (newCurrency: string) => {
    const updatedSettings = { ...settings, currency: newCurrency };
    setSettings(updatedSettings);
    saveStoredSettings(updatedSettings);
    showToast(`تم تغيير العملة المعتمدة إلى "${newCurrency}".`);
  };

  // Load demo dataset handler
  const handleLoadDemo = () => {
    if (window.confirm('هل تريد تفعيل وتحميل النسخة التجريبية الكاملة بالريال اليمني والأصول النموذجية وتصنيفاتها؟')) {
      loadDemoDataset();
      refreshData();
      showToast('تم تحميل النسخة التجريبية بالريال اليمني والأصول النموذجية بنجاح.');
    }
  };

  // Export all to Excel with full color and RTL
  const handleExportAllExcel = () => {
    exportAssetsToExcel(assets, categories, settings.currency, settings.companyName);
    showToast('تم تصدير ملف سجل الأصول الملون بنجاح.');
  };

  // Print filtered assets directly
  const handlePrintFiltered = (filteredList: Asset[]) => {
    setActiveTab('reports');
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 border border-sky-500/50 px-4 py-3 text-xs font-semibold text-white shadow-2xl shadow-black/60 animate-bounce">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-400'
            }`}
          />
          {toast.message}
        </div>
      )}

      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenExeInfo={() => setIsExeInfoModalOpen(true)}
        onExportAllExcel={handleExportAllExcel}
        assetsCount={assets.length}
        currency={settings.currency}
        onChangeCurrency={handleChangeCurrency}
        onLoadDemo={handleLoadDemo}
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 space-y-6">
        {/* KPI Stats Bar - visible on all tabs except print */}
        <div className="no-print">
          <StatsCards assets={assets} currency={settings.currency} />
        </div>

        {/* Tab 1: Assets List */}
        {activeTab === 'assets' && (
          <AssetList
            assets={assets}
            categories={categories}
            currency={settings.currency}
            onAddNew={() => {
              setEditingAsset(null);
              setIsAssetModalOpen(true);
            }}
            onEdit={(asset) => {
              setEditingAsset(asset);
              setIsAssetModalOpen(true);
            }}
            onDelete={handleDeleteAsset}
            onViewSchedule={(asset) => setScheduleModalAsset(asset)}
            onDispose={(asset) => setDisposalModalAsset(asset)}
            onExportExcel={(filtered) => {
              exportAssetsToExcel(filtered, categories, settings.currency, settings.companyName, `سجل_الأصول_المفلترة_${filtered.length}_أصل.xlsx`);
              showToast(`تم تصدير ${filtered.length} أصل إلى إكسل ملون بنجاح.`);
            }}
            onPrintReport={handlePrintFiltered}
          />
        )}

        {/* Tab 2: Calculator & Comparison Sandbox */}
        {activeTab === 'calculator' && (
          <DepreciationCalculatorWidget currency={settings.currency} />
        )}

        {/* Tab 3: Reports & PDF */}
        {activeTab === 'reports' && (
          <ReportsView
            assets={assets}
            categories={categories}
            currency={settings.currency}
            companyName={settings.companyName}
          />
        )}

        {/* Tab 4: Disposals & Sales */}
        {activeTab === 'disposals' && (
          <DisposalsView
            assets={assets}
            currency={settings.currency}
            onRestoreAsset={handleRestoreAsset}
          />
        )}

        {/* Tab 5: Local Backup & Settings */}
        {activeTab === 'backup' && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
            <BackupRestoreModal
              isOpen={true}
              onClose={() => setActiveTab('assets')}
              onDataChanged={refreshData}
              currency={settings.currency}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => {
          setIsAssetModalOpen(false);
          setEditingAsset(null);
        }}
        onSave={handleSaveAsset}
        categories={categories}
        editingAsset={editingAsset}
        currency={settings.currency}
      />

      <DepreciationScheduleModal
        isOpen={!!scheduleModalAsset}
        onClose={() => setScheduleModalAsset(null)}
        asset={scheduleModalAsset}
        currency={settings.currency}
      />

      <DisposalModal
        isOpen={!!disposalModalAsset}
        onClose={() => setDisposalModalAsset(null)}
        asset={disposalModalAsset}
        onConfirmDisposal={handleConfirmDisposal}
        currency={settings.currency}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
        categories={categories}
        currency={settings.currency}
      />

      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataChanged={refreshData}
        currency={settings.currency}
      />

      <StandaloneExeModal
        isOpen={isExeInfoModalOpen}
        onClose={() => setIsExeInfoModalOpen(false)}
      />

      {/* Footer */}
      <footer className="no-print border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            {settings.companyName} © {new Date().getFullYear()} - نظام إدارة وحساب إهلاك الأصول الثابتة
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>تخزين محلي 100% بدون إنترنت</span>
            <span>•</span>
            <span>أرقام وتواريخ بالصيغة الإنجليزية</span>
            <span>•</span>
            <button
              onClick={() => setIsExeInfoModalOpen(true)}
              className="text-sky-400 hover:underline"
            >
              تشغيل كـ EXE
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
