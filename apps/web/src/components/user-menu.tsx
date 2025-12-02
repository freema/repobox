"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name || "User"}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-medium">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <span className="text-sm text-neutral-300 hidden sm:block">{user.name || user.email}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-20">
            <div className="px-4 py-3 border-b border-neutral-700">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-neutral-400 truncate">{user.email}</p>
            </div>
            <div className="p-2">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-md transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
