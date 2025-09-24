'use client'

import { useRouter } from 'next/navigation'
import { Card, Button, Badge } from '@/components/design-system'
import {
  Car,
  Zap,
  Database,
  Shield,
  Activity,
  FileSearch,
  Cpu,
  Network,
  ArrowRight,
  CheckCircle,
  Users,
  Globe,
  TrendingUp,
  BarChart3,
  Settings,
  Layers
} from 'lucide-react'

export default function Home() {
  const router = useRouter()

  const features = [
    {
      icon: <Database className="icon-lg" />,
      title: 'ODX Management',
      description: 'Comprehensive ODX file parsing and management for automotive diagnostics',
      color: 'var(--color-primary)'
    },
    {
      icon: <Cpu className="icon-lg" />,
      title: 'ECU Discovery',
      description: 'Automatic ECU detection and variant identification from trace logs',
      color: 'var(--color-success)'
    },
    {
      icon: <FileSearch className="icon-lg" />,
      title: 'Trace Analysis',
      description: 'Advanced DoIP trace file parsing with intelligent service mapping',
      color: 'var(--color-warning)'
    },
    {
      icon: <Shield className="icon-lg" />,
      title: 'Security Features',
      description: 'Enterprise-grade security with session management and authentication',
      color: 'var(--color-error)'
    },
    {
      icon: <Activity className="icon-lg" />,
      title: 'Real-time Monitoring',
      description: 'Live diagnostic session tracking and performance analytics',
      color: 'var(--color-info)'
    },
    {
      icon: <Network className="icon-lg" />,
      title: 'Multi-Protocol Support',
      description: 'Support for UDS, DoIP, and various automotive communication protocols',
      color: 'var(--color-secondary)'
    }
  ]

  const stats = [
    { number: '100+', label: 'Supported ECUs' },
    { number: '50K+', label: 'Diagnostics Processed' },
    { number: '99.9%', label: 'Uptime' },
    { number: '24/7', label: 'Support' }
  ]

  return (
    <div className="landing-container">
      {/* Header */}
      <header className="landing-header">
        <div className="ds-container">
          <nav className="nav-container">
            <div className="nav-brand">
              <Car className="icon-md" />
              <span className="brand-text">OptiDiagFlow</span>
            </div>
            <div className="nav-actions">
              <Button variant="ghost" onClick={() => router.push('/auth/signin')}>
                Sign In
              </Button>
              <Button variant="primary" onClick={() => router.push('/auth/signup')}>
                Get Started
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="ds-container">
          <div className="hero-content">
            <Badge variant="success" style={{ marginBottom: 'var(--space-md)' }}>
              <Activity className="icon-xs" style={{ marginRight: 'var(--space-xs)' }} />
              Live Demo Available
            </Badge>
            <h1 className="hero-title">
              Professional Automotive
              <span className="hero-highlight"> Diagnostic Platform</span>
            </h1>
            <p className="hero-description">
              Streamline your vehicle diagnostics with advanced ODX processing,
              real-time ECU discovery, and comprehensive trace analysis. Built for
              automotive professionals and OEM partners.
            </p>
            <div className="hero-actions">
              <Button
                variant="primary"
                size="lg"
                icon={<ArrowRight className="icon-sm" />}
                onClick={() => router.push('/dashboard')}
              >
                Start Free Trial
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => router.push('/auth/signin')}
              >
                View Demo
              </Button>
            </div>
            <div className="hero-stats">
              {stats.map((stat, index) => (
                <div key={index} className="stat-item">
                  <div className="stat-number">{stat.number}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="ds-container">
          <div className="section-header">
            <Badge variant="default" style={{ marginBottom: 'var(--space-md)' }}>
              Features
            </Badge>
            <h2 className="section-title">
              Everything You Need for Modern Diagnostics
            </h2>
            <p className="section-description">
              Comprehensive tools and features designed to make automotive diagnostics
              faster, more accurate, and easier to manage.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <Card key={index} className="feature-card" variant="default">
                <div
                  className="feature-icon"
                  style={{ color: feature.color }}
                >
                  {feature.icon}
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="ds-container">
          <div className="benefits-grid">
            <div className="benefits-content">
              <Badge variant="info" style={{ marginBottom: 'var(--space-md)' }}>
                Why Choose OptiDiagFlow
              </Badge>
              <h2 className="section-title">
                Built for Professionals, Trusted by Industry Leaders
              </h2>
              <div className="benefits-list">
                <div className="benefit-item">
                  <CheckCircle className="benefit-icon" />
                  <div>
                    <h4 className="benefit-title">Industry Standards Compliance</h4>
                    <p className="benefit-description">
                      Full compliance with ODX, UDS, and DoIP standards
                    </p>
                  </div>
                </div>
                <div className="benefit-item">
                  <CheckCircle className="benefit-icon" />
                  <div>
                    <h4 className="benefit-title">Enterprise-Ready</h4>
                    <p className="benefit-description">
                      Scalable architecture with robust security features
                    </p>
                  </div>
                </div>
                <div className="benefit-item">
                  <CheckCircle className="benefit-icon" />
                  <div>
                    <h4 className="benefit-title">Real-time Processing</h4>
                    <p className="benefit-description">
                      Lightning-fast trace analysis and ECU discovery
                    </p>
                  </div>
                </div>
                <div className="benefit-item">
                  <CheckCircle className="benefit-icon" />
                  <div>
                    <h4 className="benefit-title">Comprehensive Support</h4>
                    <p className="benefit-description">
                      24/7 technical support and regular updates
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="benefits-visual">
              <Card variant="info" className="visual-card">
                <div className="visual-header">
                  <BarChart3 className="icon-md" />
                  <span className="ds-heading-3">Performance Metrics</span>
                </div>
                <div className="visual-stats">
                  <div className="visual-stat">
                    <TrendingUp className="icon-sm" style={{ color: 'var(--color-success)' }} />
                    <span>50% Faster Diagnostics</span>
                  </div>
                  <div className="visual-stat">
                    <Users className="icon-sm" style={{ color: 'var(--color-primary)' }} />
                    <span>1000+ Active Users</span>
                  </div>
                  <div className="visual-stat">
                    <Globe className="icon-sm" style={{ color: 'var(--color-info)' }} />
                    <span>30+ Countries</span>
                  </div>
                  <div className="visual-stat">
                    <Layers className="icon-sm" style={{ color: 'var(--color-warning)' }} />
                    <span>15+ OEM Partners</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="ds-container">
          <Card variant="primary" className="cta-card">
            <div className="cta-content">
              <h2 className="cta-title">Ready to Transform Your Diagnostics?</h2>
              <p className="cta-description">
                Join thousands of automotive professionals using OptiDiagFlow
              </p>
              <div className="cta-actions">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => router.push('/auth/signup')}
                >
                  Start Free Trial
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  style={{ color: 'white' }}
                  onClick={() => router.push('/auth/signin')}
                >
                  Contact Sales
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="ds-container">
          <div className="footer-content">
            <div className="footer-brand">
              <Car className="icon-md" />
              <span className="brand-text">OptiDiagFlow</span>
            </div>
            <p className="footer-copyright">
              © 2024 OptiDiagFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .landing-container {
          min-height: 100vh;
          background: var(--color-bg-primary);
        }

        /* Header */
        .landing-header {
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--color-border);
          z-index: 100;
          padding: var(--space-md) 0;
        }

        .nav-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .brand-text {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .nav-actions {
          display: flex;
          gap: var(--space-sm);
        }

        /* Hero Section */
        .hero-section {
          padding: var(--space-3xl) 0;
          background: linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%);
          border-bottom: 1px solid var(--color-border);
        }

        .hero-content {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }

        .hero-title {
          font-size: 3.5rem;
          font-weight: 700;
          line-height: 1.2;
          color: var(--color-text-primary);
          margin-bottom: var(--space-md);
        }

        .hero-highlight {
          color: var(--color-primary);
        }

        .hero-description {
          font-size: var(--font-size-lg);
          color: var(--color-text-secondary);
          margin-bottom: var(--space-xl);
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          gap: var(--space-md);
          justify-content: center;
          margin-bottom: var(--space-2xl);
        }

        .hero-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: var(--space-md);
          max-width: 600px;
          margin: 0 auto;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: var(--color-primary);
          margin-bottom: var(--space-xs);
        }

        .stat-label {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        /* Features Section */
        .features-section {
          padding: var(--space-3xl) 0;
          background: var(--color-bg-primary);
        }

        .section-header {
          text-align: center;
          max-width: 600px;
          margin: 0 auto var(--space-2xl);
        }

        .section-title {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: var(--space-md);
        }

        .section-description {
          font-size: var(--font-size-md);
          color: var(--color-text-secondary);
          line-height: 1.6;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--space-md);
        }

        .feature-card {
          text-align: center;
          padding: var(--space-xl);
          transition: transform 0.2s;
        }

        .feature-card:hover {
          transform: translateY(-4px);
        }

        .feature-icon {
          margin-bottom: var(--space-md);
        }

        .feature-title {
          font-size: var(--font-size-lg);
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: var(--space-sm);
        }

        .feature-description {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        /* Benefits Section */
        .benefits-section {
          padding: var(--space-3xl) 0;
          background: var(--color-bg-secondary);
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2xl);
          align-items: center;
        }

        .benefits-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          margin-top: var(--space-xl);
        }

        .benefit-item {
          display: flex;
          gap: var(--space-md);
        }

        .benefit-icon {
          color: var(--color-success);
          flex-shrink: 0;
          width: 24px;
          height: 24px;
        }

        .benefit-title {
          font-size: var(--font-size-md);
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: var(--space-xs);
        }

        .benefit-description {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .visual-card {
          padding: var(--space-xl);
        }

        .visual-header {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          margin-bottom: var(--space-xl);
        }

        .visual-stats {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-md);
        }

        .visual-stat {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm);
          background: var(--color-bg-primary);
          border-radius: var(--radius-sm);
        }

        /* CTA Section */
        .cta-section {
          padding: var(--space-3xl) 0;
          background: var(--color-bg-primary);
        }

        .cta-card {
          text-align: center;
          padding: var(--space-3xl);
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
        }

        .cta-title {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: white;
          margin-bottom: var(--space-sm);
        }

        .cta-description {
          font-size: var(--font-size-md);
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: var(--space-xl);
        }

        .cta-actions {
          display: flex;
          gap: var(--space-md);
          justify-content: center;
        }

        /* Footer */
        .landing-footer {
          padding: var(--space-xl) 0;
          background: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .footer-copyright {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        /* Icons */
        .icon-xs {
          width: 14px;
          height: 14px;
        }

        .icon-sm {
          width: 16px;
          height: 16px;
        }

        .icon-md {
          width: 20px;
          height: 20px;
        }

        .icon-lg {
          width: 32px;
          height: 32px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero-title {
            font-size: 2rem;
          }

          .hero-actions {
            flex-direction: column;
          }

          .benefits-grid {
            grid-template-columns: 1fr;
          }

          .footer-content {
            flex-direction: column;
            gap: var(--space-md);
            text-align: center;
          }
        }
      `}</style>
    </div>
  )
}