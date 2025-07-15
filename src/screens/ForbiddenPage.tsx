import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon, HomeIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context';

export const ForbiddenPage = () => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Access Denied
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Error 403 - Forbidden
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Administrator Access Required
            </h3>
            
            <p className="text-sm text-gray-500 mb-6">
              You don't have sufficient permissions to access this resource. 
              This page requires administrator privileges.
            </p>

            <div className="space-y-3">
              <Link
                to="/"
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <HomeIcon className="h-4 w-4 mr-2" />
                Go to Home
              </Link>
              
              <button
                onClick={logout}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <ArrowRightStartOnRectangleIcon className="h-4 w-4 mr-2" />
                Switch Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
