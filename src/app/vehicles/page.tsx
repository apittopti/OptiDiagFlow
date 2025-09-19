'use client';

import React, { useState } from 'react';
import PageLayout from '@/components/layout/page-layout';
import { Car, Plus, Cpu, AlertTriangle, CheckCircle, MoreVertical, Search, Calendar, Wrench } from 'lucide-react';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  ecuCount: number;
  activeDtcs: number;
  historicalDtcs: number;
  lastScanned: string;
  imageUrl?: string;
}

const mockVehicles: Vehicle[] = [
  { id: '1', make: 'BMW', model: '330i', year: 2021, vin: 'WBA5U7C05M7G12345', ecuCount: 42, activeDtcs: 3, historicalDtcs: 12, lastScanned: '2 hours ago' },
  { id: '2', make: 'Mercedes-Benz', model: 'C300', year: 2020, vin: 'W1KZF8KB0LA123456', ecuCount: 38, activeDtcs: 0, historicalDtcs: 5, lastScanned: '1 day ago' },
  { id: '3', make: 'Audi', model: 'A4', year: 2022, vin: 'WAUENAF42MN123456', ecuCount: 45, activeDtcs: 1, historicalDtcs: 8, lastScanned: '3 days ago' },
  { id: '4', make: 'Volkswagen', model: 'Golf GTI', year: 2021, vin: 'WVWZZZAUZLW123456', ecuCount: 35, activeDtcs: 0, historicalDtcs: 3, lastScanned: '1 week ago' },
  { id: '5', make: 'Porsche', model: 'Cayenne', year: 2023, vin: 'WP1AA2AY2PDA12345', ecuCount: 52, activeDtcs: 2, historicalDtcs: 7, lastScanned: '5 hours ago' },
  { id: '6', make: 'BMW', model: 'X5', year: 2022, vin: 'WBACR6C51MD123456', ecuCount: 48, activeDtcs: 0, historicalDtcs: 4, lastScanned: '2 days ago' },
];

const brandColors: { [key: string]: string } = {
  'BMW': '#0066cc',
  'Mercedes-Benz': '#00adef',
  'Audi': '#bb0a30',
  'Volkswagen': '#001e50',
  'Porsche': '#d5001c',
};

export default function VehiclesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicles] = useState<Vehicle[]>(mockVehicles);

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.vin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalActiveDtcs = vehicles.reduce((sum, v) => sum + v.activeDtcs, 0);
  const totalEcus = vehicles.reduce((sum, v) => sum + v.ecuCount, 0);

  return (
    <PageLayout
      title="Vehicles"
      description="Manage your vehicle fleet and diagnostic profiles"
    >
      <div style={{ padding: '24px' }}>
        {/* Search and Add Bar */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '32px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            flex: '1',
            minWidth: '300px',
            position: 'relative'
          }}>
            <Search style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              color: '#6b7280'
            }} />
            <input
              type="text"
              placeholder="Search by make, model, or VIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                backgroundColor: '#ffffff'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <button style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.25)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.25)';
          }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Add Vehicle
          </button>
        </div>

        {/* Statistics Overview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #667eea15 0%, #764ba205 100%)',
            border: '1px solid #667eea20'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Total Vehicles</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>{vehicles.length}</div>
              </div>
              <Car style={{ width: 24, height: 24, color: '#667eea', opacity: 0.5 }} />
            </div>
          </div>

          <div style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b98115 0%, #10b98105 100%)',
            border: '1px solid #10b98120'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Total ECUs</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>{totalEcus}</div>
              </div>
              <Cpu style={{ width: 24, height: 24, color: '#10b981', opacity: 0.5 }} />
            </div>
          </div>

          <div style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #ef444415 0%, #ef444405 100%)',
            border: '1px solid #ef444420'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Active DTCs</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef4444' }}>{totalActiveDtcs}</div>
              </div>
              <AlertTriangle style={{ width: 24, height: 24, color: '#ef4444', opacity: 0.5 }} />
            </div>
          </div>
        </div>

        {/* Vehicles Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '24px'
        }}>
          {filteredVehicles.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              padding: '80px 20px',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '16px',
              border: '2px dashed #e5e7eb'
            }}>
              <Car style={{ width: 48, height: 48, color: '#9ca3af', margin: '0 auto 16px' }} />
              <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>
                No vehicles found
              </div>
              <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                Add a vehicle or adjust your search criteria
              </div>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                style={{
                  borderRadius: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Vehicle Header with Brand Color */}
                <div style={{
                  padding: '20px',
                  background: `linear-gradient(135deg, ${brandColors[vehicle.make]}15 0%, ${brandColors[vehicle.make]}05 100%)`,
                  borderBottom: `1px solid ${brandColors[vehicle.make]}20`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: brandColors[vehicle.make]
                        }} />
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                          {vehicle.make}
                        </span>
                      </div>
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '4px'
                      }}>
                        {vehicle.model} {vehicle.year}
                      </h3>
                      <div style={{ fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {vehicle.vin}
                      </div>
                    </div>
                    <button style={{
                      padding: '6px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6b7280',
                      borderRadius: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical style={{ width: 18, height: 18 }} />
                    </button>
                  </div>
                </div>

                {/* Vehicle Stats */}
                <div style={{ padding: '20px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <Cpu style={{ width: 20, height: 20, color: '#10b981' }} />
                      <div>
                        <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827' }}>
                          {vehicle.ecuCount}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>ECUs</div>
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      backgroundColor: vehicle.activeDtcs > 0 ? '#fef2f2' : '#f0fdf4',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      {vehicle.activeDtcs > 0 ? (
                        <AlertTriangle style={{ width: 20, height: 20, color: '#ef4444' }} />
                      ) : (
                        <CheckCircle style={{ width: 20, height: 20, color: '#10b981' }} />
                      )}
                      <div>
                        <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827' }}>
                          {vehicle.activeDtcs}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>Active DTCs</div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Wrench style={{ width: 14, height: 14, color: '#6b7280' }} />
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {vehicle.historicalDtcs} Historical DTCs
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar style={{ width: 14, height: 14, color: '#6b7280' }} />
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {vehicle.lastScanned}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageLayout>
  );
}