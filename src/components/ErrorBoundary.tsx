import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
          <div className="max-w-2xl w-full bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="p-3 bg-red-500/10 rounded-full">
                <AlertTriangle size={32} />
              </div>
              <h1 className="text-2xl font-bold">Application Error</h1>
            </div>
            
            <p className="text-slate-300 mb-6">
              Something went wrong while rendering the application. 
              Please verify your installation or report this error.
            </p>

            <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm overflow-auto max-h-64 border border-slate-700 mb-6">
              <p className="text-red-400 font-bold mb-2">
                {this.state.error?.toString()}
              </p>
              <pre className="text-slate-500 whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                <RefreshCw size={18} />
                Reload Application
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                <RefreshCw size={18} />
                Clear Data & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
