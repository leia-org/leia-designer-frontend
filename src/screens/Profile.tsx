import { useAuth } from "../context";

export const Profile = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-xl text-gray-700 mb-4">App Context</h1>
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
