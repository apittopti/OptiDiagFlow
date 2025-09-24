"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, Lock, User, AlertCircle, Car } from 'lucide-react'
import { Card, Button } from '@/components/design-system'

export default function SignUpPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name })
      })

      if (response.ok) {
        router.push('/auth/signin')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create account')
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

        {/* Sign Up Card */}
        <Card className="auth-card">
          <div className="card-header" style={{ textAlign: 'center' }}>
            <h2 className="ds-heading-2">Create Account</h2>
            <p className="ds-text-secondary">
              Enter your information to create a new account
            </p>
          </div>

          <form onSubmit={onSubmit} className="auth-form">
            <div className="ds-form-group">
              <label className="ds-label">Name</label>
              <div className="input-with-icon">
                <User className="input-icon" />
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={isLoading}
                  className="ds-input"
                  style={{ paddingLeft: 'var(--space-xl)' }}
                />
              </div>
            </div>

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
                  placeholder="Minimum 8 characters"
                  required
                  disabled={isLoading}
                  minLength={8}
                  className="ds-input"
                  style={{ paddingLeft: 'var(--space-xl)' }}
                />
              </div>
              <p className="ds-text-secondary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-xs)' }}>
                Password must be at least 8 characters long
              </p>
            </div>

            {/* Terms and Conditions */}
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  className="checkbox-input"
                />
                <span className="ds-text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
                  I agree to the{' '}
                  <a href="#" className="link-primary">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="link-primary">Privacy Policy</a>
                </span>
              </label>
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
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          {/* Divider */}
          <div className="divider">
            <span className="divider-text">OR</span>
          </div>

          {/* Sign In Link */}
          <p className="auth-footer">
            Already have an account?{' '}
            <Link href="/auth/signin" className="link-primary">
              Sign in
            </Link>
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
          align-items: flex-start;
          cursor: pointer;
          font-size: var(--font-size-sm);
        }

        .checkbox-input {
          margin-right: var(--space-xs);
          margin-top: 2px;
          cursor: pointer;
          flex-shrink: 0;
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