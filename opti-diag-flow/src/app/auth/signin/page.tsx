"use client"

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, Lock, AlertCircle, Car } from 'lucide-react'
import { Card, Button, Badge } from '@/components/design-system'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-content">
        {/* Logo and Title */}
        <div className="auth-logo">
          <div className="auth-icon">
            <Car size={40} />
          </div>
          <h1 className="ds-heading-1">OptiDiagFlow</h1>
          <p className="ds-text-secondary">
            Automotive Diagnostic Management System
          </p>
        </div>

        {/* Login Card */}
        <Card className="auth-card">
          <div className="card-header" style={{ textAlign: 'center' }}>
            <h2 className="ds-heading-2">Welcome back</h2>
            <p className="ds-text-secondary">
              Sign in to your account to continue
            </p>
          </div>

          {/* Demo Credentials Notice */}
          <Card variant="info" style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ textAlign: 'center' }}>
              <p className="ds-label" style={{ marginBottom: 'var(--space-xs)' }}>Demo Credentials</p>
              <p className="ds-value">Email: demo@optiflow.com</p>
              <p className="ds-value">Password: demo123</p>
            </div>
          </Card>

          <form onSubmit={onSubmit} className="auth-form">
            <div className="ds-form-group">
              <label className="ds-label">Email Address</label>
              <div className="input-with-icon">
                <Mail className="input-icon" />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  disabled={isLoading}
                  className="ds-input"
                  style={{ paddingLeft: 'var(--space-xl)' }}
                />
              </div>
            </div>

            <div className="ds-form-group">
              <label className="ds-label">Password</label>
              <div className="input-with-icon">
                <Lock className="input-icon" />
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                  className="ds-input"
                  style={{ paddingLeft: 'var(--space-xl)' }}
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="ds-flex-between" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  className="checkbox-input"
                />
                <span className="ds-text-secondary">Remember me</span>
              </label>
              <a
                href="#"
                className="link-primary"
              >
                Forgot password?
              </a>
            </div>

            {/* Error Message */}
            {error && (
              <Card variant="error" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="ds-flex-row">
                  <AlertCircle size={18} />
                  <p style={{ margin: 0 }}>{error}</p>
                </div>
              </Card>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading}
              icon={isLoading ? <Loader2 className="animate-spin" /> : undefined}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="divider">
            <span className="divider-text">OR</span>
          </div>

          {/* Sign Up Link */}
          <p className="auth-footer">
            Don't have an account?{' '}
            <a href="/auth/signup" className="link-primary">
              Sign up
            </a>
          </p>
        </Card>

        {/* Footer */}
        <p className="auth-copyright">
          © 2024 OptiDiagFlow. All rights reserved.
        </p>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
        }

        .auth-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-md);
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
        }

        .auth-logo {
          text-align: center;
          margin-bottom: var(--space-xl);
        }

        .auth-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          border-radius: var(--radius-lg);
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          margin-bottom: var(--space-md);
          color: white;
        }

        .auth-logo h1 {
          color: white;
          margin-bottom: var(--space-xs);
        }

        .auth-logo p {
          color: rgba(255, 255, 255, 0.8);
        }

        .auth-card {
          width: 100%;
          box-shadow: var(--shadow-xl);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
        }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: var(--space-sm);
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          color: var(--color-text-secondary);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: var(--font-size-sm);
        }

        .checkbox-input {
          margin-right: var(--space-xs);
          cursor: pointer;
        }

        .link-primary {
          color: var(--color-primary);
          text-decoration: none;
          font-size: var(--font-size-sm);
          font-weight: 500;
          transition: text-decoration 0.2s;
        }

        .link-primary:hover {
          text-decoration: underline;
        }

        .divider {
          display: flex;
          align-items: center;
          margin: var(--space-md) 0;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background-color: var(--color-border);
        }

        .divider-text {
          padding: 0 var(--space-md);
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .auth-footer {
          text-align: center;
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin: 0;
        }

        .auth-copyright {
          text-align: center;
          font-size: var(--font-size-xs);
          color: rgba(255, 255, 255, 0.6);
          margin-top: var(--space-xl);
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}