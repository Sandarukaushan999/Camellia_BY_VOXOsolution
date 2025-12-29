import React, { useEffect, useState } from "react";
import api from "../utils/api.js";

const UNITS = [
  { value: "grams", label: "Grams (g)", conversionFactor: 1 },
  { value: "kilograms", label: "Kilograms (kg)", conversionFactor: 1000 },
  { value: "pieces", label: "Pieces", conversionFactor: 1 },
  { value: "liters", label: "Liters (L)", conversionFactor: 1 },
  { value: "ml", label: "Milliliters (mL)", conversionFactor: 0.001 },
];

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    name: "",
    quantity: "",
    unit: "grams",
    expire_date: "",
    low_stock_threshold: "",
    category: "",
    cost_per_unit: "",
  });
  const [alerts, setAlerts] = useState({ lowStock: [], expiringSoon: [], expired: [] });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const loadInventory = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/inventory");
      setItems(data);
      loadAlerts();
    } catch (err) {
      console.error("Failed to load inventory", err);
      setItems([]);
      setMessage("Failed to load inventory");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const { data } = await api.get("/inventory/alerts/summary");
      setAlerts(data);
    } catch (err) {
      console.error("Failed to load alerts", err);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);


  const openAddModal = () => {
    setEditingItem(null);
    setForm({
      name: "",
      quantity: "",
      unit: "grams",
      expire_date: "",
      low_stock_threshold: "",
      category: "",
      cost_per_unit: "",
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      quantity: item.quantity || "",
      unit: item.unit || "grams",
      expire_date: item.expire_date ? item.expire_date.split("T")[0] : "",
      low_stock_threshold: item.low_stock_threshold || "",
      category: item.category || "",
      cost_per_unit: item.cost_per_unit || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!form.name) {
      setMessage("Name is required");
      return;
    }

    try {
      const payload = {
        name: form.name,
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit,
        expire_date: form.expire_date || null,
        low_stock_threshold: parseFloat(form.low_stock_threshold) || 0,
        category: form.category || null,
        cost_per_unit: form.cost_per_unit ? parseFloat(form.cost_per_unit) : null,
      };

      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        setMessage("Inventory item updated successfully");
      } else {
        await api.post("/inventory", payload);
        setMessage("Inventory item created successfully");
      }

      setShowModal(false);
      loadInventory();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to save inventory item");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Are you sure you want to delete this inventory item?")) return;

    try {
      await api.delete(`/inventory/${id}`);
      setMessage("Inventory item deleted");
      loadInventory();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Failed to delete inventory item");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const convertQuantity = (quantity, fromUnit, toUnit) => {
    const fromUnitObj = UNITS.find((u) => u.value === fromUnit);
    const toUnitObj = UNITS.find((u) => u.value === toUnit);
    
    if (!fromUnitObj || !toUnitObj) return quantity;
    
    // Convert to base unit (grams for weight, liters for volume)
    let baseQuantity = quantity * fromUnitObj.conversionFactor;
    
    // Convert from base unit to target unit
    return baseQuantity / toUnitObj.conversionFactor;
  };

  const formatQuantity = (quantity, unit) => {
    const qty = parseFloat(quantity);
    if (isNaN(qty)) return "0";

    if (unit === "grams") {
      if (qty >= 1000) {
        const kg = (qty / 1000).toFixed(3);
        return `${kg} kg (${qty.toFixed(2)} g)`;
      }
      return `${qty.toFixed(2)} g`;
    } else if (unit === "kilograms") {
      const g = qty * 1000;
      return `${qty.toFixed(3)} kg (${g.toFixed(2)} g)`;
    }
    
    return `${qty.toFixed(2)} ${unit}`;
  };

  const getStatusBadge = (item) => {
    if (item.status === "expired") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          ⚠️ Expired
        </span>
      );
    }
    if (item.status === "expiring_soon") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          ⏰ Expiring Soon
        </span>
      );
    }
    if (item.status === "low_stock") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          📉 Low Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        ✓ Normal
      </span>
    );
  };

  const getDaysUntilExpiry = (expireDate) => {
    if (!expireDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expireDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredItems = items.filter((item) => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !item.name.toLowerCase().includes(term) &&
        !item.category?.toLowerCase().includes(term)
      ) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== "ALL") {
      if (filterStatus === "LOW_STOCK" && item.status !== "low_stock") return false;
      if (filterStatus === "EXPIRING" && item.status !== "expiring_soon") return false;
      if (filterStatus === "EXPIRED" && item.status !== "expired") return false;
      if (filterStatus === "NORMAL" && item.status !== "normal") return false;
    }

    return true;
  });

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-600 mt-1">Manage raw materials and ingredients</p>
          </div>
          <button
            onClick={openAddModal}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        </div>

        {/* Alerts Summary */}
        {(alerts.lowStock?.length > 0 || alerts.expiringSoon?.length > 0 || alerts.expired?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {alerts.expired?.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-red-800">Expired Items</div>
                    <div className="text-2xl font-bold text-red-600">{alerts.expired.length}</div>
                  </div>
                  <div className="text-3xl">⚠️</div>
                </div>
              </div>
            )}
            {alerts.expiringSoon?.length > 0 && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-orange-800">Expiring Soon</div>
                    <div className="text-2xl font-bold text-orange-600">{alerts.expiringSoon.length}</div>
                  </div>
                  <div className="text-3xl">⏰</div>
                </div>
              </div>
            )}
            {alerts.lowStock?.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-yellow-800">Low Stock</div>
                    <div className="text-2xl font-bold text-yellow-600">{alerts.lowStock.length}</div>
                  </div>
                  <div className="text-3xl">📉</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="md:w-48">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="EXPIRING">Expiring Soon</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-left">Expire Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const daysUntilExpiry = getDaysUntilExpiry(item.expire_date);
                    return (
                      <tr
                        key={item.id}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {item.category || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-medium text-gray-900">
                            {formatQuantity(item.quantity, item.unit)}
                          </div>
                          {item.low_stock_threshold > 0 && (
                            <div className="text-xs text-gray-500">
                              Low: {formatQuantity(item.low_stock_threshold, item.unit)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.expire_date ? (
                            <div>
                              <div className="text-gray-900">
                                {new Date(item.expire_date).toLocaleDateString()}
                              </div>
                              {daysUntilExpiry !== null && (
                                <div
                                  className={`text-xs ${
                                    daysUntilExpiry < 0
                                      ? "text-red-600 font-semibold"
                                      : daysUntilExpiry <= 3
                                      ? "text-orange-600 font-semibold"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {daysUntilExpiry < 0
                                    ? `${Math.abs(daysUntilExpiry)} days ago`
                                    : daysUntilExpiry === 0
                                    ? "Expires today"
                                    : `${daysUntilExpiry} days left`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(item)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingItem ? "Edit Inventory Item" : "Add Inventory Item"}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Name *
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </label>
                      <input
                        type="text"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="e.g., Meat, Vegetables, Dairy"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit *
                      </label>
                      <select
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        {UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Low Stock Threshold
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={form.low_stock_threshold}
                        onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                        placeholder="Alert when stock reaches this level"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expire Date
                      </label>
                      <input
                        type="date"
                        value={form.expire_date}
                        onChange={(e) => setForm({ ...form, expire_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Barcode
                      </label>
                      <input
                        type="text"
                        value={form.barcode}
                        onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                        placeholder="Optional barcode/scan code"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost per Unit (Rs.)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.cost_per_unit}
                        onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })}
                        placeholder="Optional"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
                    >
                      {editingItem ? "Update Item" : "Create Item"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-xl z-50">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
