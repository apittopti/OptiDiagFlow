"use client"

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, Lock, AlertCircle, Car } from 'lucide-react'

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px'
        }}>
          {/* Logo and Title */}
          <div style={{
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              marginBottom: '20px'
            }}>
              <Car size={40} style={{ color: '#ffffff' }} />
            </div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '8px'
            }}>
              OptiDiagFlow
            </h1>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              Automotive Diagnostic Management System
            </p>
          </div>

          {/* Login Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#0f172a',
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              Welcome back
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              marginBottom: '32px',
              textAlign: 'center'
            }}>
              Sign in to your account to continue
            </p>

            {/* Demo Credentials Notice */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '24px'
            }}>
              <p style={{
                fontSize: '13px',
                color: '#ffffff',
                margin: 0,
                textAlign: 'center'
              }}>
                <strong>Demo Credentials:</strong><br />
                Email: demo@optiflow.com | Password: demo123
              </p>
            </div>

            <form onSubmit={onSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#0f172a',
                  marginBottom: '8px'
                }}>
                  Email Address
                </label>
                <div style={{
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8'
                  }}>
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      fontSize: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      backgroundColor: isLoading ? '#f8fafc' : '#ffffff',
                      boxSizing: 'border-box' as const
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#0f172a',
                  marginBottom: '8px'
                }}>
                  Password
                </label>
                <div style={{
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8'
                  }}>
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      fontSize: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      backgroundColor: isLoading ? '#f8fafc' : '#ffffff',
                      boxSizing: 'border-box' as const
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '14px',
                  color: '#64748b',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    style={{
                      marginRight: '8px',
                      cursor: 'pointer'
                    }}
                  />
                  Remember me
                </label>
                <a
                  href="#"
                  style={{
                    fontSize: '14px',
                    color: '#3b82f6',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none'
                  }}
                >
                  Forgot password?
                </a>
              </div>

              {/* Error Message */}
              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  marginBottom: '20px'
                }}>
                  <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p style={{
                    fontSize: '14px',
                    color: '#ef4444',
                    margin: 0
                  }}>
                    {error}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#ffffff',
                  background: isLoading
                    ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '24px 0'
            }}>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: '#e2e8f0'
              }} />
              <span style={{
                padding: '0 16px',
                fontSize: '13px',
                color: '#94a3b8'
              }}>
                OR
              </span>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: '#e2e8f0'
              }} />
            </div>

            {/* Sign Up Link */}
            <p style={{
              textAlign: 'center',
              fontSize: '14px',
              color: '#64748b',
              margin: 0
            }}>
              Don't have an account?{' '}
              <a
                href="/auth/signup"
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none'
                }}
              >
                Sign up
              </a>
            </p>
          </div>

          {/* Footer */}
          <p style={{
            textAlign: 'center',
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginTop: '32px'
          }}>
            © 2024 OptiDiagFlow. All rights reserved.
          </p>
        </div>
      </div>

      <style jsx>{`
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