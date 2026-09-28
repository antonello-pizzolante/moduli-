import React from 'react';
import { MonthlySheet } from '../types';
import { PrivateArchiveManager } from './PrivateArchiveManager';

interface ArchiveViewProps {
  sheets: MonthlySheet[];
  currentSheetId: string;
  onSelectSheet: (sheetId: string) => void;
  onCreateNewMonth: (year: number, month: number) => void;
  onDeleteSheet: (sheetId: string) => void;
  onReloadAll: () => void;
  onOpenFolderSettings?: () => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  sheets,
  currentSheetId,
  onSelectSheet,
  onCreateNewMonth,
  onDeleteSheet,
  onReloadAll,
  onOpenFolderSettings,
}) => {
  return (
    <PrivateArchiveManager
      sheets={sheets}
      currentSheetId={currentSheetId}
      onSelectSheet={onSelectSheet}
      onCreateNewMonth={onCreateNewMonth}
      onDeleteSheet={onDeleteSheet}
      onReloadAll={onReloadAll}
      onOpenFolderSettings={onOpenFolderSettings}
    />
  );
};
