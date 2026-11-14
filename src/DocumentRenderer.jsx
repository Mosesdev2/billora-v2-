const money = (n) =>
  "KSh " + Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 });

export default function DocumentRenderer({ template, business = {}, data = {} }) {
  const c = template?.config || {};
  const accent = c.accent || "#B8F34A";
  const fields = c.fields || [];
  const extras = (c.extras || []).filter((e) => e.enabled);
  const items = data.items || [];

  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.qty || 1) * Number(it.price || 0),
    0
  );
  const discount = c.totals?.showDiscount ? Number(data.discount || 0) : 0;
  const tax = c.totals?.showTax ? (subtotal - discount) * 0.16 : 0;
  const total = subtotal - discount + tax;

  const cell = { padding: "8px 4px", borderBottom: "1px solid #e8e4dc" };

  return (
    <div
      style={{
        background: "#faf8f3",
        color: "#1f1f1f",
        maxWidth: 420,
        margin: "0 auto",
        padding: 20,
        borderTop: `6px solid ${accent}`,
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        {c.header?.showLogo && business.logo && (
          <img src={business.logo} alt="" style={{ height: 48, marginBottom: 6 }} />
        )}
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {business.name || "Your Business"}
        </div>
        {c.header?.showAddress && business.address && <div>{business.address}</div>}
        {c.header?.showPhone && business.phone && <div>{business.phone}</div>}
      </div>

      <div style={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
        {template?.doc_type?.replace("_", " ") || "Receipt"}
        {data.number ? ` #${data.number}` : ""}
      </div>
      <div style={{ marginBottom: 12, color: "#666" }}>
        {data.date || new Date().toLocaleDateString("en-KE")}
        {data.customer ? ` · ${data.customer}` : ""}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {fields.map((f) => (
              <th key={f.key} style={{ ...cell, textAlign: "left" }}>
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              {fields.map((f) => (
                <td key={f.key} style={cell}>
                  {f.type === "money" ? money(it[f.key]) : it[f.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, textAlign: "right" }}>
        <div>Subtotal: {money(subtotal)}</div>
        {discount > 0 && <div>Discount: -{money(discount)}</div>}
        {tax > 0 && <div>VAT 16%: {money(tax)}</div>}
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
          Total: {money(total)}
        </div>
      </div>

      {extras.length > 0 && (
        <div style={{ marginTop: 12, color: "#444" }}>
          {extras.map((e) => (
            <div key={e.key}>
              {e.label}: {data.extras?.[e.key] || "-"}
            </div>
          ))}
        </div>
      )}

      {c.footer && (
        <div style={{ marginTop: 16, textAlign: "center", color: "#666" }}>
          {c.footer}
        </div>
      )}
    </div>
  );
}