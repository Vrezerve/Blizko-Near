import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          padding: 16,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 12,
          color: '#991b1b',
          fontSize: 14
        }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Ошибка отображения компонента</p>
          <p style={{ fontSize: 12 }}>{this.state.error?.message || 'Неизвестная ошибка'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
