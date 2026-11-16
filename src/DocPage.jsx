import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import TemplateDocs from './TemplateDocs.jsx';
import './business.css';

const PLURAL = { invoice: 'invoices', receipt: 'receipts', delivery_note: 'delivery notes' };

export default function DocPage({ docType, Legacy, onNavigate }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let off = false;
    supabase
      .from('businesses')
      .select('id,name,address,phone,tax_pin,till_number,currency,business_type,active_templates')
      .order('created_at', { ascending: true })
      .limit(1)
      .then(({ data, error }) => {
        if (off) return;
        setState(error ? { error: error.message } : { biz: data[0] || null });
      });
    return () => {
      off = true;
    };
  }, []);

  if (state.loading) return <p>Loading...</p>;
  if (state.error) {
    return (
      <p className="notice error" role="alert">
        {state.error}
      </p>
    );
  }

  const biz = state.biz;
  const type = biz && biz.business_type;

  if (!biz || !type || type === 'logistics') {
    if (Legacy) return <Legacy />;
    return (
      <p>
        {!biz
          ? 'Create your business profile first (Business tab).'
          : 'Receipts are for shops. Your business uses Invoices and Delivery notes.'}
      </p>
    );
  }

  const tid = (biz.active_templates || {})[docType];
  if (!tid) {
    return (
      <div className="biz-form">
        <h2>Choose your {PLURAL[docType]} template</h2>
        <p>
          Pick a template and save it in the Templates tab. Your {PLURAL[docType]} will follow it.
        </p>
        <button className="btn-primary" type="button" onClick={() => onNavigate('Templates')}>
          Choose template
        </button>
      </div>
    );
  }

  return (
    <TemplateDocs
      key={tid}
      biz={biz}
      docType={docType}
      templateId={tid}
      onNavigate={onNavigate}
    />
  );
}