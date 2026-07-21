import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Onverwachte fout in de app:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty" style={{ padding: 24 }}>
          Er ging iets onverwacht mis. Herlaad de pagina; als dit blijft
          gebeuren, neem contact op met de beheerder.
        </div>
      );
    }
    return this.props.children;
  }
}
