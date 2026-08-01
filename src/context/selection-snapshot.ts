/**
 * User-selected workbook context captured for an explicit Nyx workflow.
 *
 * This state is intentionally separate from per-turn auto-context. A capture
 * remains stable until the user refreshes or clears it.
 */

export interface SelectionSnapshot {
  /** Fully qualified worksheet/range address, for example `Sheet1!B2:D20`. */
  address: string;
  /** Bounded, human-readable preview of the selected data and nearby context. */
  preview: string;
  /** Privacy-preserving workbook identity, when the host can provide one. */
  workbookId?: string;
  /** Unix timestamp in milliseconds when the selection was captured. */
  capturedAt: number;
}

export type SelectionCaptureState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "captured"; snapshot: SelectionSnapshot }
  | { status: "error" };

export const EMPTY_SELECTION_CAPTURE_STATE: SelectionCaptureState = { status: "empty" };

/** Create a new immutable selection snapshot from a bounded selection context. */
export function createSelectionSnapshot(args: {
  address: string;
  preview: string;
  workbookId?: string | null;
  capturedAt?: number;
}): SelectionSnapshot {
  const snapshot: SelectionSnapshot = {
    address: args.address,
    preview: args.preview,
    capturedAt: args.capturedAt ?? Date.now(),
  };

  if (args.workbookId) {
    snapshot.workbookId = args.workbookId;
  }

  return Object.freeze(snapshot);
}
