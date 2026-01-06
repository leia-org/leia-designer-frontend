import { ChevronRightIcon } from "@heroicons/react/24/outline";

export const Header = ({ title }: { title?: string }) => {
    return (
        <header className="h-14 flex items-center justify-between px-8 bg-white border-b border-gray-100 sticky top-0 z-30">
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="hover:text-gray-900 transition-colors cursor-pointer">Designer</span>
                <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                {title && <h1 className="font-medium text-gray-900">{title}</h1>}
            </div>
            <div className="flex items-center gap-4">
                {/* Future: Notifications / Context Actions */}
            </div>
        </header>
    );
};
