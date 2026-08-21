import React, { type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uygulama hatası:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 30, color: "#e6ebf2", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#ef5c5c" }}>Bir hata oluştu</h2>
          <p>{this.state.message}</p>
          <button
            style={{
              padding: "8px 16px",
              background: "#ff8a3d",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
            }}
            onClick={() => this.setState({ hasError: false })}
          >
            Tekrar Dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
