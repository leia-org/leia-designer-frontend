interface ActivityReplicationModalProps {
  isOpen: boolean;
  name: string;
  onNameChange: (name: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const ActivityReplicationModal: React.FC<ActivityReplicationModalProps> = ({
  isOpen,
  name,
  onNameChange,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-semibold text-gray-900">
            Replicate activity
          </h2>
          <label className="mt-5 block text-sm font-medium text-gray-700">
            Choose a new name for both the activity and the replication.
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Activity replication name"
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!name.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Replicate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};