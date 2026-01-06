import { NavLink } from "react-router-dom";
import { useAuth } from "../../context";
import {
    PlusCircleIcon,
    UserCircleIcon,
    Cog6ToothIcon,
    ArrowLeftOnRectangleIcon,
    Squares2X2Icon,
    MagnifyingGlassIcon,
    ListBulletIcon,
    UsersIcon,
} from "@heroicons/react/24/outline";

export const Sidebar = () => {
    const { user, logout } = useAuth();

    const navigation = [
        { name: "Search LEIAs", href: "/", icon: MagnifyingGlassIcon },
        { name: "Design a new LEIA", href: "/create", icon: PlusCircleIcon },
        { name: "My Activities", href: "/users/me/activities", icon: ListBulletIcon },
        { name: "Profile", href: "/profile", icon: UserCircleIcon },
    ];

    if (user?.role === "admin") {
        navigation.push({ name: "Manage users", href: "/administration/users", icon: UsersIcon });
    }

    return (
        <div className="flex flex-col w-64 bg-[#fbfbfa] h-screen fixed left-0 top-0 z-50 border-r border-gray-200/60">
            <div className="px-5 py-6">
                <div className="flex items-center gap-2.5 mb-8">
                    <div className="flex items-center justify-center w-8 h-8">
                        <img src="/logo/leia_puzzle_clear.png" alt="LEIA Logo" />
                    </div>
                    <span className="font-semibold text-gray-900 tracking-tight text-[15px]">LEIA Designer</span>
                </div>

                <div className="space-y-1">
                    <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider px-3 mb-2">
                        Workspace
                    </div>
                    <nav className="space-y-0.5">
                        {navigation.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                end={item.href === "/"} // Only precise match for root to avoid highlighting both if duplicates exist, though keeping both active might be desired if they point to same place.
                                className={({ isActive }) =>
                                    `flex items-center gap-2.5 px-3 py-2 text-[14px] font-medium rounded-md transition-all duration-200 ${isActive
                                        ? "bg-white text-indigo-600 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.03)]"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                                    }`
                                }
                            >
                                <item.icon className="w-[18px] h-[18px]" />
                                {item.name}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="mt-auto p-4 border-t border-gray-100 bg-white/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3 px-1">
                    <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {user?.email?.[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                        <p className="text-[11px] text-gray-500 truncate capitalize">
                            {user?.role}
                        </p>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="flex items-center gap-2 px-1 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors w-full"
                >
                    <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                    Sign out
                </button>
            </div>
        </div>
    );
};
