import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  PlusIcon,
  UsersIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../context/useAuth";

interface NavigationItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  show?: boolean;
}

interface HeaderProps {
  title: string;
  description: string;
  rightContent?: React.ReactNode;
  navigationItems?: NavigationItem[];
  showNavigation?: boolean; // Control para mostrar/ocultar el dropdown
}

export const Header: React.FC<HeaderProps> = ({
  title,
  description,
  rightContent,
  navigationItems,
  showNavigation = true, // Por defecto se muestra
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Default navigation items if none provided
  const defaultNavigationItems: NavigationItem[] = [
    {
      label: "Search LEIAs",
      href: "/",
      icon: <MagnifyingGlassIcon className="w-4 h-4" />,
      show: true,
    },
    {
      label: "Design a new LEIA",
      href: "/create",
      icon: <PlusIcon className="w-4 h-4" />,
      show: true,
    },
    {
      label: "Manage users",
      href: "/administration/users",
      icon: <UsersIcon className="w-4 h-4" />,
      show: user?.role === "admin",
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <UserIcon className="w-4 h-4" />,
      show: true,
    },
  ];

  // Use provided navigationItems or default ones
  const itemsToUse = navigationItems || defaultNavigationItems;

  // Filter items that should be shown
  const visibleItems = showNavigation
    ? itemsToUse.filter((item) => item.show !== false)
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownOpen &&
        !(event.target as Element)?.closest(".navigation-dropdown")
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-baseline gap-4 flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-gray-600">{description}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-6">
          {visibleItems.length > 0 && (
            <div className="relative navigation-dropdown">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Navigation menu"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    {visibleItems.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          navigate(item.href);
                          setDropdownOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {rightContent && <div>{rightContent}</div>}
        </div>
      </div>
    </div>
  );
};
