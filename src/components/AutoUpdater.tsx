/**
 * AutoUpdater stub for claude-code-clean
 * All auto-update functionality disabled
 */

import * as React from 'react';

type Props = {
  isUpdating: boolean;
  onChangeIsUpdating: (isUpdating: boolean) => void;
  onAutoUpdaterResult: (autoUpdaterResult: any) => void;
  autoUpdaterResult: any | null;
  showSuccessMessage: boolean;
  verbose: boolean;
};

export function AutoUpdater(props: Props): React.ReactNode {
  // No-op: Auto-updates disabled in claude-code-clean
  return null;
}
