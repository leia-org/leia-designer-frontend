import { useAuth } from "../context";
import { Header } from "../components/shared/Header";

export const Profile = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Profile"
        description="View and manage your account information"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            {user && (
              <div className="bg-gray-50 rounded-md p-4">
                <pre className="text-xs text-gray-700 overflow-auto">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
