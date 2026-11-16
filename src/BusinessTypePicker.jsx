export const businessTypes = [
  { id: 'minimarket', icon: '🧺', title: 'Minimarket', desc: 'Small supermarket, grocery, mini mart' },
  { id: 'retail', icon: '🛒', title: 'Retail shop', desc: 'Kiosk, boutique, pharmacy' },
  { id: 'wholesale', icon: '📦', title: 'Wholesale', desc: 'Bulk supply to shops and businesses' },
  { id: 'hardware', icon: '🔧', title: 'Hardware', desc: 'Building materials, tools, paint' },
  { id: 'electronics', icon: '📱', title: 'Electronics', desc: 'Phones, chargers, appliances' },
  { id: 'logistics', icon: '🚚', title: 'Logistics', desc: 'Delivery, transport, courier' },
  { id: 'other', icon: '🏪', title: 'Something else', desc: 'Start with the basic receipt' },
];

// "other" falls back to the retail template
export const templateTypeFor = (id) => (id === 'other' ? 'retail' : id);

export default function BusinessTypePicker({ value, onChange }) {
  return (
    <div>
      <h2 style={{ margin: '0 0 4px' }}>What kind of business do you run?</h2>
      <p style={{ margin: '0 0 16px', color: '#666' }}>
        We will set up the right receipts for you. You can customize them later.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {businessTypes.map((t, i) => {
          const on = value === t.id;
          const lastOdd = businessTypes.length % 2 === 1 && i === businessTypes.length - 1;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(t.id)}
              style={{
                gridColumn: lastOdd ? 'span 2' : undefined,
                position: 'relative',
                textAlign: 'left',
                padding: 14,
                minHeight: 120,
                borderRadius: 16,
                border: on ? '2px solid #1f1f1f' : '2px solid #e3dfd3',
                background: on ? '#1f1f1f' : '#ffffff',
                color: on ? '#faf8f3' : '#1f1f1f',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 22,
                  background: on ? '#B8F34A' : '#f3f0e6',
                }}
              >
                {t.icon}
              </span>
              <strong style={{ fontSize: 15 }}>{t.title}</strong>
              <span style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.3 }}>{t.desc}</span>

              {on && (
                <span
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#B8F34A',
                    color: '#1f1f1f',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}