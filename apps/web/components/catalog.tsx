"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Monitor,
  Smartphone,
  Headphones,
  Gamepad2,
  Package,
  Pencil,
  Archive,
  Trash2,
} from "lucide-react";
import { type Product, money, specTemplates } from "@reply/shared";
import { type Snapshot, type Action } from "./workspace-types";
import { Modal, Field, Empty, api } from "./ui";
import { CatalogTools,ProductImages } from './catalog-tools';
export function Catalog({
  data,
  act,
  inventory = false,
  initialQuery = '',
  refresh,
}: {
  data: Snapshot;
  act: Action;
  inventory?: boolean;
  initialQuery?: string;
  refresh:()=>void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [edit, setEdit] = useState<Product | null | undefined>();
  const [variant, setVariant] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [archived, setArchived] = useState(false);
  const [page,setPage]=useState(1);
  const [catalog,setCatalog]=useState({products:data.products,total:data.productCount,page:1,pages:1});
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      setLoading(true);setLoadError('');
      api<typeof catalog>('/api/catalog?'+new URLSearchParams({q:query,page:String(page),archived:String(archived)}),{signal:controller.signal})
        .then(result=>{if(!controller.signal.aborted)setCatalog(result);})
        .catch(error=>{if(!controller.signal.aborted)setLoadError(error.message);})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },150);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query,page,archived,data]);
  const rows=catalog.products;
  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <h1>{inventory ? "Inventory" : "Your product catalog"}</h1>
          <p className="muted">
            {inventory
              ? "Keep availability accurate. Every adjustment leaves a record."
              : "The source of truth for every customer conversation."}
          </p>
        </div>
        <button className="btn primary" onClick={() => setEdit(null)}>
          <Plus size={17} /> Add product
        </button>
      </div>
      <CatalogTools refresh={refresh}/>
      <div className="panel" style={{ padding: 0 }}>
        <div className="table-toolbar row between wrap">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search products"
              placeholder="Search products, SKU, specifications…"
              value={query}
              onChange={(e) => {setQuery(e.target.value);setPage(1);}}
            />
          </div>
          <label className="row small">
            <input
              style={{ width: 16 }}
              type="checkbox"
              checked={archived}
              onChange={(e) => {setArchived(e.target.checked);setPage(1);}}
            />{" "}
            Show archived
          </label>
          <span className="badge gray">{data.productCount} products</span>
        </div>
        {loadError&&<div className="error" role="alert">{loadError}</div>}
        <div className="table-scroll" aria-busy={loading}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const Icon =
                  p.category === "Laptop"
                    ? Monitor
                    : p.category === "Smartphone"
                      ? Smartphone
                      : p.category === "Gaming"
                        ? Gamepad2
                        : p.category === "Audio"
                          ? Headphones
                          : Package;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="row">
                        <div className="product-icon">
                          <Icon size={23} />
                        </div>
                        <div>
                          <strong>{p.name}</strong>
                          <div className="small muted">
                            {p.sku || "No SKU"} · {p.brand}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td>{money(p.price, p.currency)}</td>
                    <td>
                      <strong>{p.stock}</strong>{" "}
                      <span className="small muted">units</span>
                    </td>
                    <td>
                      <span
                        className={"badge " + (p.stock <= 3 ? "amber" : "")}
                      >
                        {p.archived
                          ? "Archived"
                          : p.stock === 0
                            ? "Out of stock"
                            : p.stock <= 3
                              ? "Low stock"
                              : "In stock"}
                      </span>
                    </td>
                    <td>
                      <div className="row">
                        <button
                          className="icon-btn"
                          title="Edit product"
                          aria-label={"Edit " + p.name}
                          onClick={() => setEdit(p)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          title="Add variant"
                          aria-label={"Add variant to " + p.name}
                          onClick={() => setVariant(p)}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          title="Archive product"
                          aria-label={"Archive " + p.name}
                          onClick={() =>
                            act("product.save", { ...p, archived: !p.archived })
                          }
                        >
                          <Archive size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          title="Delete product"
                          aria-label={"Delete " + p.name}
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading&&!rows.length && (
          <Empty>
            {query?'No products match this search.':'Add your first product to help customers find what they need.'}
          </Empty>
        )}
        <div className="table-toolbar row between wrap small muted">
          <span>{loading?'Loading…':`Showing ${rows.length} of ${catalog.total} · Page ${catalog.page} of ${catalog.pages}`} · Prices use IQD units or USD/EUR cents.</span>
          <div className="row"><button className="btn" disabled={loading||catalog.page<=1} onClick={()=>setPage(catalog.page-1)}>Previous page</button><button className="btn" disabled={loading||catalog.page>=catalog.pages} onClick={()=>setPage(catalog.page+1)}>Next page</button></div>
        </div>
      </div>
      {inventory && (
        <div className="panel">
          <h2>Inventory history</h2>
          {data.movements.map((m) => (
            <div className="list-row" key={m.id}>
              <span>
                {data.products.find((p) => p.id === m.product_id)?.name ||
                  "Product"}
                <small className="muted"> · {m.reason}</small>
              </span>
              <strong>
                {m.quantity > 0 ? "+" : ""}
                {m.quantity}
              </strong>
            </div>
          ))}
        </div>
      )}
      {edit !== undefined && (
        <ProductEditor
          product={edit}
          currency={data.org.currency}
          onClose={() => setEdit(undefined)}
          act={act}
        />
      )}
      {variant && (
        <Modal
          title={"Add variant · " + variant.name}
          onClose={() => setVariant(null)}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act("variant.add", {
                  productId: variant.id,
                  name: f.get("name"),
                  price: Number(f.get("price")),
                  stock: Number(f.get("stock")),
                })
              )
                setVariant(null);
            }}
          >
            <Field
              label="Variant name"
              name="name"
              required
              placeholder="Black / 256GB"
            />
            <Field
              label="Price (minor currency units)"
              name="price"
              type="number"
              min={0}
              step={1}
              required
            />
            <Field
              label="Stock"
              name="stock"
              type="number"
              min={0}
              step={1}
              required
            />
            <button className="btn primary">Add variant</button>
            <p className="small muted">
              Variants have independent stock. Customers must choose a variant
              when ordering.
            </p>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete this product?"
          description="Products with order history must be archived instead."
          onClose={() => setDeleting(null)}
        >
          <p>{deleting.name}</p>
          <button
            className="btn danger"
            onClick={async () => {
              if (await act("product.delete", deleting.id)) setDeleting(null);
            }}
          >
            Delete product
          </button>
        </Modal>
      )}
    </div>
  );
}
function ProductEditor({
  product,
  currency,
  onClose,
  act,
}: {
  product: Product | null;
  currency: string;
  onClose: () => void;
  act: Action;
}) {
  const [template, setTemplate] = useState(product?.category || "Laptop");
  const [specs, setSpecs] = useState<Record<string, string>>(
    product?.specs || {},
  );
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);
  const keys = [
    ...new Set([...(specTemplates[template] || []), ...Object.keys(specs)]),
  ];
  return (
    <Modal
      title={product ? "Edit product" : "Add a product"}
      description="Give your assistant accurate facts. Leave unknown specifications blank."
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const ok = await act("product.save", {
            ...(product ? { id: product.id,version:product.version } : {}),
            name: f.get("name"),
            description: f.get("description"),
            brand: f.get("brand"),
            sku: f.get("sku"),
            category: template,
            price: Number(f.get("price")),
            currency: f.get("currency"),
            stock: Number(f.get("stock")),
            archived: product?.archived || false,
            specs: Object.fromEntries(
              Object.entries(specs).filter(([, v]) => v.trim()),
            ),
            details: {
              barcode: f.get("barcode"),
              condition: f.get("condition"),
              warranty: f.get("warranty"),
              shipping: f.get("shipping"),
              tags: String(f.get("tags") || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            },
          });
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <Field
          label="Product name"
          name="name"
          required
          minLength={2}
          defaultValue={product?.name}
        />
        <div className="grid two">
          <label>
            Category / specification template
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              {[
                ...new Set([
                  ...Object.keys(specTemplates),
                  "Audio",
                  "Accessories",
                  "General",
                  template,
                ]),
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Field label="Brand" name="brand" defaultValue={product?.brand} />
          <Field label="SKU" name="sku" defaultValue={product?.sku} />
          <Field
            label="Barcode"
            name="barcode"
            defaultValue={product?.details.barcode}
          />
          <Field
            label="Price (IQD units; USD/EUR cents)"
            name="price"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={product?.price}
          />
          <label>
            Currency
            <select
              name="currency"
              defaultValue={product?.currency || currency}
            >
              <option>IQD</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
          <Field
            label="Stock quantity"
            name="stock"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={product?.stock || 0}
          />
          <Field
            label="Condition"
            name="condition"
            defaultValue={product?.details.condition || "New"}
          />
        </div>
        <label>
          Description
          <textarea name="description" defaultValue={product?.description} />
        </label>
        <div className="grid two">
          <Field
            label="Warranty"
            name="warranty"
            defaultValue={product?.details.warranty}
          />
          <Field
            label="Shipping information"
            name="shipping"
            defaultValue={product?.details.shipping}
          />
        </div>
        <Field
          label="Tags (comma separated)"
          name="tags"
          defaultValue={product?.details.tags.join(", ")}
        />
        <h3>Specifications</h3>
        <div className="grid two">
          {keys.map((key) => (
            <Field
              label={key}
              key={key}
              value={specs[key] || ""}
              onChange={(e) => setSpecs({ ...specs, [key]: e.target.value })}
            />
          ))}
        </div>
        <div className="row">
          <input
            aria-label="Custom specification name"
            placeholder="Custom specification name"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (newKey.trim()) {
                setSpecs({ ...specs, [newKey.trim()]: "" });
                setNewKey("");
              }
            }}
          >
            Add field
          </button>
        </div>
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving…" : "Save product"}
        </button>
        {product && <ProductImages productId={product.id}/>}
      </form>
    </Modal>
  );
}
