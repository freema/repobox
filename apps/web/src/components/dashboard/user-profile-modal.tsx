"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useDashboard } from "@/contexts/dashboard-context";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface UserProfileModalProps {
  user: User;
}

export function UserProfileModal({ user }: UserProfileModalProps) {
  const { state, dispatch } = useDashboard();
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.isProfileModalOpen) {
        dispatch({ type: "TOGGLE_PROFILE_MODAL" });
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [state.isProfileModalOpen, dispatch]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        state.isProfileModalOpen &&
        modalRef.current &&
        !modalRef.current.contains(e.target as Node)
      ) {
        dispatch({ type: "TOGGLE_PROFILE_MODAL" });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [state.isProfileModalOpen, dispatch]);

  if (!state.isProfileModalOpen) return null;

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="fixed inset-0 z-50" data-testid="user-profile-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Modal - positioned at bottom left */}
      <div
        ref={modalRef}
        className="absolute bottom-16 left-4 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* User info header */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "User avatar"}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-lg font-medium text-white">
                {(user.name || user.email || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {user.name || "User"}
              </p>
              {user.email && (
                <p className="text-xs text-neutral-500 truncate">{user.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="p-2">
          <Link
            href="/settings"
            onClick={() => dispatch({ type: "TOGGLE_PROFILE_MODAL" })}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white rounded-lg transition-colors"
            data-testid="settings-link"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white rounded-lg transition-colors"
            data-testid="sign-out-button"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
