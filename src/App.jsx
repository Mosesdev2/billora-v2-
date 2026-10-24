import { useState } from 'react';

const sections = [
  'Overview',
  'Invoices',
  'Quotations',
  'Delivery notes',
  'Customers',
];

export default function App() {
  const [active, setActive] = useState('Overview');

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Billora</strong>
        <nav className="nav">
          {sections.map((name) => (
            <button
              key={name}
              type="button"
              className={name === active ? 'nav-btn is-active' : 'nav-btn'}
              onClick={() => setActive(name)}
            >
              {name}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        <h1>{active}</h1>
        {active === 'Overview' ? (
          <p>Billora helps you manage invoices, quotations and delivery notes.</p>
        ) : (
          <p>{active} will be built here soon.</p>
        )}
      </main>
    </div>
  );
}