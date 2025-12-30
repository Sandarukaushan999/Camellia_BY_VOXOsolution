import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const REPORT_TYPES = [
  { id: "sales", label: "Sales Reports", icon: "📅" },
  { id: "inventory", label: "Inventory Reports", icon: "📦" },
  { id: "expenses", label: "Expenses Reports", icon: "💰" },
  { id: "payment", label: "Payment Reports", icon: "💳" },
  { id: "profit", label: "Profit & Loss", icon: "📊" },
];

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function Reports() {
  const [activeReport, setActiveReport] = useState("sales");
  const [dateRange, setDateRange] = useState("30"); // days
  const [orderType, setOrderType] = useState("ALL");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Data states
  const [salesData, setSalesData] = useState([]);
  const [detailedSales, setDetailedSales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [inventoryData, setInventoryData] = useState({ transactions: [], summary: [], lowStock: [], expired: [] });
  const [expensesData, setExpensesData] = useState({ expenses: [], byCategory: [], monthlyTotal: 0 });
  const [paymentData, setPaymentData] = useState({ methods: [], totalAmount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [activeReport, dateRange, orderType, paymentMethod, startDate, endDate]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      if (activeReport === "sales") {
        const params = new URLSearchParams({
          days: dateRange,
          orderType: orderType,
          paymentMethod: paymentMethod,
        });
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        
        const [salesRes, detailedRes, monthlyRes] = await Promise.all([
          api.get(`/admin/reports/sales?${params}`),
          api.get(`/admin/reports/sales/detailed?${params}`),
          api.get("/admin/reports/sales/monthly"),
        ]);
        setSalesData(salesRes.data || []);
        setDetailedSales(detailedRes.data || []);
        setMonthlySales(monthlyRes.data || []);
      } else if (activeReport === "inventory") {
        const params = new URLSearchParams({ days: dateRange });
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        
        const res = await api.get(`/admin/reports/inventory?${params}`);
        setInventoryData(res.data || { transactions: [], summary: [], lowStock: [], expired: [] });
      } else if (activeReport === "expenses") {
        const params = new URLSearchParams({ days: dateRange });
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        
        const res = await api.get(`/admin/reports/expenses?${params}`);
        setExpensesData(res.data || { expenses: [], byCategory: [], monthlyTotal: 0 });
      } else if (activeReport === "payment") {
        const params = new URLSearchParams({ days: dateRange });
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        
        const res = await api.get(`/admin/reports/payments?${params}`);
        setPaymentData(res.data || { methods: [], totalAmount: 0 });
      }
    } catch (err) {
      console.error("Failed to load report data", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary metrics
  const salesSummary = useMemo(() => {
    const totalSales = salesData.reduce((sum, d) => sum + parseFloat(d.total || 0), 0);
    const totalOrders = salesData.reduce((sum, d) => sum + parseInt(d.orderCount || 0), 0);
    const avgBill = totalOrders > 0 ? totalSales / totalOrders : 0;
    const currentMonthTotal = monthlySales.find(m => {
      const month = new Date(m.month);
      const now = new Date();
      return month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear();
    });
    
    return {
      totalSales: totalSales.toFixed(2),
      totalOrders,
      avgBill: avgBill.toFixed(2),
      monthlyTotal: currentMonthTotal ? parseFloat(currentMonthTotal.total || 0).toFixed(2) : "0.00",
    };
  }, [salesData, monthlySales]);

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Export to CSV
  const handleExportExcel = () => {
    let csvContent = "";
    let filename = "";

    if (activeReport === "sales") {
      filename = `sales_report_${new Date().toISOString().split("T")[0]}.csv`;
      csvContent = "Order ID,Date & Time,Total,Payment Method,Order Type,Cashier\n";
      detailedSales.forEach((sale) => {
        csvContent += `${sale.id},${formatDateTime(sale.createdAt)},${sale.total},${sale.paymentMethod},${sale.orderType},${sale.createdBy}\n`;
      });
    } else if (activeReport === "expenses") {
      filename = `expenses_report_${new Date().toISOString().split("T")[0]}.csv`;
      csvContent = "ID,Title,Category,Amount,Date,Payment Method,Vendor,Created By\n";
      expensesData.expenses.forEach((exp) => {
        csvContent += `${exp.id},${exp.title},${exp.category},${exp.amount},${formatDate(exp.expenseDate)},${exp.paymentMethod},${exp.vendor || ""},${exp.createdBy}\n`;
      });
    } else if (activeReport === "inventory") {
      filename = `inventory_report_${new Date().toISOString().split("T")[0]}.csv`;
      csvContent = "Date & Time,Item Name,Category,Transaction Type,Quantity,Unit,Created By,Notes\n";
      inventoryData.transactions.forEach((tx) => {
        csvContent += `${formatDateTime(tx.createdAt)},${tx.itemName},${tx.category || ""},${tx.type},${tx.quantity},${tx.unit},${tx.createdBy},${tx.notes || ""}\n`;
      });
    } else if (activeReport === "payment") {
      filename = `payment_report_${new Date().toISOString().split("T")[0]}.csv`;
      csvContent = "Payment Method,Count,Total Amount,Percentage\n";
      paymentData.methods.forEach((method) => {
        csvContent += `${method.method},${method.count},${method.total},${method.percentage}%\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handlePrint = () => {
    window.print();
  };

  // Chart data preparation
  const salesChartData = useMemo(() => {
    return salesData.map((d) => ({
      date: formatDate(d.day),
      sales: parseFloat(d.total || 0),
      orders: parseInt(d.orderCount || 0),
    }));
  }, [salesData]);

  const orderTypeData = useMemo(() => {
    const types = {};
    detailedSales.forEach((sale) => {
      const type = sale.orderType || "DINE-IN";
      types[type] = (types[type] || 0) + parseFloat(sale.total || 0);
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [detailedSales]);

  const paymentChartData = useMemo(() => {
    return paymentData.methods.map((m) => ({
      name: m.method,
      value: parseFloat(m.total || 0),
      count: m.count,
      percentage: parseFloat(m.percentage || 0),
    }));
  }, [paymentData]);

  const expensesChartData = useMemo(() => {
    return expensesData.byCategory.map((cat) => ({
      name: cat.category,
      value: parseFloat(cat.total || 0),
      count: cat.count,
    }));
  }, [expensesData]);

  return (
    <div className="p-3 md:p-4 lg:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4 mb-4 md:mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-600 mt-1">Business insights and analytics</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportPDF}
              className="px-2 md:px-3 py-1.5 md:py-2 bg-red-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-1.5"
            >
              <span className="text-sm md:text-base">📄</span> <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-2 md:px-3 py-1.5 md:py-2 bg-green-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1.5"
            >
              <span className="text-sm md:text-base">📊</span> <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2 md:px-3 py-1.5 md:py-2 bg-gray-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            >
              <span className="text-sm md:text-base">🖨</span> <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Report Type Selector */}
        <div className="bg-white rounded-xl shadow-md p-2 mb-4 md:mb-6 border border-gray-200">
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveReport(type.id)}
                className={`flex-1 min-w-[120px] sm:min-w-[140px] px-2 md:px-3 py-2 md:py-2.5 rounded-lg font-medium text-xs md:text-sm transition-all ${
                  activeReport === type.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span className="mr-1 md:mr-1.5 text-sm md:text-base">{type.icon}</span>
                <span className="hidden sm:inline">{type.label}</span>
                <span className="sm:hidden">{type.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-xl shadow-md p-3 md:p-4 mb-4 md:mb-6 border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  setStartDate("");
                  setEndDate("");
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 3 Months</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {dateRange === "custom" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
            {activeReport === "sales" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Types</option>
                    <option value="DINE-IN">Dine-In</option>
                    <option value="TAKEAWAY">Takeaway</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Methods</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="QR">QR</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Report Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-gray-600">Loading report data...</div>
          </div>
        ) : (
          <>
            {/* Sales Reports */}
            {activeReport === "sales" && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Sales</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(salesSummary.totalSales)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Selected Period</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Orders</div>
                    <div className="text-2xl font-bold text-gray-900">{salesSummary.totalOrders}</div>
                    <div className="text-xs text-gray-500 mt-1">Orders processed</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Average Bill</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(salesSummary.avgBill)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Per order</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">This Month Total</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(salesSummary.monthlyTotal)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Current month</div>
                  </div>
                </div>

                {/* Daily Sales Chart - Bar Chart */}
                {salesChartData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Daily Sales Trend</h2>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <BarChart data={salesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="sales" fill="#3B82F6" name="Sales (Rs.)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Daily Sales Chart - Line Chart */}
                {salesChartData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Sales Trend (Line Chart)</h2>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <LineChart data={salesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="sales" stroke="#10B981" strokeWidth={2} name="Sales (Rs.)" />
                        <Line type="monotone" dataKey="orders" stroke="#F59E0B" strokeWidth={2} name="Orders" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Order Type Breakdown - Pie Chart */}
                {orderTypeData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Order Type Breakdown</h2>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <PieChart>
                        <Pie
                          data={orderTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {orderTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Detailed Sales Table */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Detailed Sales</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Order ID</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date & Time</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cashier</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Payment</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {detailedSales.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                              No sales data available
                            </td>
                          </tr>
                        ) : (
                          detailedSales.slice(0, 50).map((sale) => (
                            <tr key={sale.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">#{sale.id}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatDateTime(sale.createdAt)}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{sale.createdBy}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  {sale.orderType}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{sale.paymentMethod}</td>
                              <td className="px-6 py-4 text-sm font-semibold text-right">{formatCurrency(sale.total)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Reports */}
            {activeReport === "inventory" && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Transactions</div>
                    <div className="text-2xl font-bold text-gray-900">{inventoryData.transactions.length}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Low Stock Items</div>
                    <div className="text-2xl font-bold text-orange-600">{inventoryData.lowStock.length}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Expired Items</div>
                    <div className="text-2xl font-bold text-red-600">{inventoryData.expired.length}</div>
                  </div>
                </div>

                {/* Inventory by Category Chart */}
                {inventoryData.summary.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Inventory Value by Category</h2>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <BarChart data={inventoryData.summary}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="totalValue" fill="#8B5CF6" name="Value (Rs.)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Low Stock Items */}
                {inventoryData.lowStock.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Low Stock Items</h2>
                    <div className="space-y-2">
                      {inventoryData.lowStock.map((item) => (
                        <div key={item.id} className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded-lg">
                          <div className="font-semibold text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-600">
                            Stock: {item.quantity} {item.unit} (Threshold: {item.low_stock_threshold} {item.unit})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expired Items */}
                {inventoryData.expired.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Expired Items</h2>
                    <div className="space-y-2">
                      {inventoryData.expired.map((item) => (
                        <div key={item.id} className="p-3 bg-red-50 border-l-4 border-red-500 rounded-lg">
                          <div className="font-semibold text-gray-900">{item.name}</div>
                          <div className="text-sm text-red-600">
                            Expired on: {formatDate(item.expire_date)} | Quantity: {item.quantity} {item.unit}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inventory Transactions Table */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Inventory Transactions</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date & Time</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Created By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {inventoryData.transactions.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                              No inventory transactions available
                            </td>
                          </tr>
                        ) : (
                          inventoryData.transactions.slice(0, 50).map((tx, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-600">{formatDateTime(tx.createdAt)}</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{tx.itemName}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  tx.type === "ADD" ? "bg-green-100 text-green-800" :
                                  tx.type === "REMOVE" || tx.type === "SALE" ? "bg-red-100 text-red-800" :
                                  "bg-blue-100 text-blue-800"
                                }`}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{tx.quantity} {tx.unit}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{tx.createdBy}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Expenses Reports */}
            {activeReport === "expenses" && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Expenses</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(expensesData.expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Selected Period</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">This Month Total</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(expensesData.monthlyTotal)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Current month</div>
                  </div>
                </div>

                {/* Expenses by Category - Pie Chart */}
                {expensesChartData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Expenses by Category</h2>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <PieChart>
                        <Pie
                          data={expensesChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {expensesChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Expenses by Category - Bar Chart */}
                {expensesChartData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Expenses by Category (Bar Chart)</h2>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <BarChart data={expensesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="value" fill="#EF4444" name="Amount (Rs.)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Expenses Table */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Expenses Details</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Title</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Payment Method</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Created By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {expensesData.expenses.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                              No expenses data available
                            </td>
                          </tr>
                        ) : (
                          expensesData.expenses.slice(0, 50).map((exp) => (
                            <tr key={exp.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-600">{formatDate(exp.expenseDate)}</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{exp.title}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                  {exp.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-red-600">{formatCurrency(exp.amount)}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{exp.paymentMethod}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{exp.createdBy}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Reports */}
            {activeReport === "payment" && (
              <div className="space-y-6">
                {/* Summary Card */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Total Payments</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(paymentData.totalAmount)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Selected Period</div>
                </div>

                {/* Payment Method Breakdown - Pie Chart */}
                {paymentChartData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Method Breakdown</h2>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <PieChart>
                        <Pie
                          data={paymentChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {paymentChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Payment Method Breakdown - Bar Chart */}
                {paymentChartData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Methods (Bar Chart)</h2>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <BarChart data={paymentChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="value" fill="#10B981" name="Amount (Rs.)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Payment Methods Table */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Payment Methods Summary</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Payment Method</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Count</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Amount</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paymentData.methods.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                              No payment data available
                            </td>
                          </tr>
                        ) : (
                          paymentData.methods.map((method, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{method.method}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{method.count}</td>
                              <td className="px-6 py-4 text-sm font-semibold text-right">{formatCurrency(method.total)}</td>
                              <td className="px-6 py-4 text-sm text-right">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  {method.percentage}%
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Profit & Loss Reports */}
            {activeReport === "profit" && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Sales (This Month)</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(salesSummary.monthlyTotal)}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Expenses (This Month)</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(expensesData.monthlyTotal)}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Net Profit (This Month)</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(parseFloat(salesSummary.monthlyTotal) - parseFloat(expensesData.monthlyTotal))}
                    </div>
                  </div>
                </div>

                {/* Profit Calculation Card */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Profit & Loss Calculation</h2>
                    <button
                      onClick={() => alert("Gross Profit and Net Profit calculation with full balance details will be implemented in the future.")}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Calculate Gross & Net Profit
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                      <span className="font-semibold text-gray-900">Total Sales</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(salesSummary.monthlyTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                      <span className="font-semibold text-gray-900">Total Expenses</span>
                      <span className="text-xl font-bold text-red-600">
                        {formatCurrency(expensesData.monthlyTotal)}
                      </span>
                    </div>
                    <div className="border-t-2 border-gray-300 pt-4">
                      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                        <span className="text-base font-bold text-gray-900">Net Profit</span>
                        <span className="text-xl font-bold text-blue-600">
                          {formatCurrency(parseFloat(salesSummary.monthlyTotal) - parseFloat(expensesData.monthlyTotal))}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Note:</strong> Gross Profit and Net Profit calculation with detailed balance (including inventory costs, 
                      operational expenses, etc.) will be available in a future update.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
