export default function ErrorScreen({ error, onRetry }) {
  const isPermission = error?.toLowerCase().includes("403") || error?.toLowerCase().includes("permission") || error?.toLowerCase().includes("anyone");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-lg w-full">
        <div className="text-3xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Could not load spreadsheet</h2>
        <p className="text-sm text-gray-500 mb-4 font-mono bg-gray-50 p-3 rounded-lg break-words">{error}</p>

        {isPermission && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800 space-y-1">
            <p className="font-semibold">To fix this:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open the spreadsheet in Google Sheets</li>
              <li>Click <strong>Share</strong> (top right)</li>
              <li>Under "General access", choose <strong>Anyone with the link</strong></li>
              <li>Set role to <strong>Viewer</strong> and click <strong>Done</strong></li>
              <li>Also confirm <strong>Google Sheets API</strong> is enabled in your Google Cloud project</li>
            </ol>
          </div>
        )}

        <button
          onClick={onRetry}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
