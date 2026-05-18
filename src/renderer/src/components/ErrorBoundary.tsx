import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6 px-12 text-center">
          <div className="text-red-400 text-2xl font-bold uppercase tracking-widest">
            Something went wrong
          </div>
          <pre className="text-red-300 text-sm bg-gray-900 rounded-lg px-6 py-4 max-w-2xl overflow-auto text-left whitespace-pre-wrap">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-8 py-3 rounded bg-gray-700 hover:bg-gray-600 text-white font-bold tracking-widest uppercase transition-colors"
          >
            Dismiss
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
