"use client";

import { ProviderForm } from "./provider-form";

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProviderModal({ isOpen, onClose, onSuccess }: ProviderModalProps) {
  if (!isOpen) return null;

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold text-white">Add Git Provider</h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <ProviderForm onSuccess={handleSuccess} />

          {/* Help text */}
          <div className="mt-6 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
            <h3 className="font-medium text-neutral-300 mb-2 text-sm">How to get a Personal Access Token:</h3>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <strong className="text-orange-400">GitLab:</strong> Settings → Access Tokens → Create with{" "}
                <code className="bg-neutral-800 px-1 rounded">api</code> scope
              </li>
              <li>
                <strong className="text-neutral-300">GitHub:</strong> Settings → Developer settings → Fine-grained tokens → Generate with{" "}
                <code className="bg-neutral-800 px-1 rounded">repo</code> permission
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
