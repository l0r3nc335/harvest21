"use client";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { MoreVertical, ChevronRight, RefreshCw, Download, Upload } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type KPIData = {
  donations: number;
  donationAmount: number;
  accountsCreated: number;
  postsCreated: number;
  changePercentage: number;
};

type ChartDataPoint = {
  date: string;
  thisPeriod: number;
  lastPeriod: number;
};

type TopVisitedAgency = {
  id: string;
  name: string;
  lastActivity: string;
  dateCreated: string;
  status: "Active" | "Pending" | "Inactive";
};

type TopVisitorByState = {
  id: string;
  name: string;
  visits: number;
  lastVisit: string;
};

type TopVisitedChurch = {
  id: string;
  name: string;
  lastActivity: string;
  dateCreated: string;
  status: "Active" | "Pending" | "Inactive";
};

type TopDonorByState = {
  id: string;
  name: string;
  visits: number;
  lastVisit: string;
};

export function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("Jun-2025");
  const [chartView, setChartView] = useState<"daily" | "weekly">("daily");
  const [tablePeriod, setTablePeriod] = useState("This Month");

  // Generate months for the period dropdown
  const generateMonths = () => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push(date.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
    }
    return months;
  };

  const months = generateMonths();

  // Mock KPI data
  const kpiData: KPIData = {
    donations: 3167,
    donationAmount: 6343.32,
    accountsCreated: 54,
    postsCreated: 376,
    changePercentage: 5,
  };

  const chartDataPoints = useMemo(() => {
    const data: ChartDataPoint[] = [];
    const startDate = new Date(2024, 5, 1);
    const endDate = new Date(2024, 6, 1);

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    if (chartView === "daily") {
      const currentDate = new Date(startDate);
      let dayIndex = 0;
      while (currentDate < endDate) {
        const dateStr = currentDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        data.push({
          date: dateStr,
          thisPeriod: seededRandom(dayIndex * 2) * 1000 + 500,
          lastPeriod: seededRandom(dayIndex * 2 + 1) * 1000 + 400,
        });
        currentDate.setDate(currentDate.getDate() + 1);
        dayIndex++;
      }
    } else {
      const currentDate = new Date(startDate);
      let weekNum = 1;
      while (currentDate < endDate) {
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const dateStr = `Week ${weekNum}`;
        data.push({
          date: dateStr,
          thisPeriod: seededRandom(weekNum * 2) * 7000 + 3500,
          lastPeriod: seededRandom(weekNum * 2 + 1) * 7000 + 2800,
        });
        currentDate.setDate(currentDate.getDate() + 7);
        weekNum++;
      }
    }

    return data;
  }, [chartView]);

  const chartData = {
    labels: chartDataPoints.map((point) => point.date),
    datasets: [
      {
        label: "This Period",
        data: chartDataPoints.map((point) => point.thisPeriod),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Last Period",
        data: chartDataPoints.map((point) => point.lastPeriod),
        borderColor: "rgb(239, 68, 68)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          callback: function (value: number | string) {
            const numValue = typeof value === 'number' ? value : parseFloat(value);
            return "$" + numValue.toFixed(0);
          },
        },
      },
    },
  };

  // Mock table data
  const topVisitedAgencies: TopVisitedAgency[] = [
    {
      id: "1",
      name: "Urban Outreach...",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
    {
      id: "2",
      name: "Hope Rising Outr...",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
    {
      id: "3",
      name: "World Ministries",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
    {
      id: "4",
      name: "High Hopes",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
    {
      id: "5",
      name: "Urban Outreach...",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
  ];

  const topVisitorsByState: TopVisitorByState[] = [
    { id: "1", name: "Utah", visits: 4243, lastVisit: "Jan-14, 2024" },
    { id: "2", name: "Washington", visits: 3423, lastVisit: "Jan-14, 2024" },
    { id: "3", name: "Illinois", visits: 456, lastVisit: "Jan-14, 2024" },
    { id: "4", name: "New York", visits: 214, lastVisit: "Jan-14, 2024" },
    { id: "5", name: "California", visits: 123, lastVisit: "Jan-14, 2024" },
  ];

  const topVisitedChurches: TopVisitedChurch[] = [
    {
      id: "1",
      name: "Friendship Baptist",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
    {
      id: "2",
      name: "Bible Study Fello...",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
    {
      id: "3",
      name: "Bible Center",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
    {
      id: "4",
      name: "Bible Baptist",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
    {
      id: "5",
      name: "Urban Outreach...",
      lastActivity: "Jun-24, 2025 3:45",
      dateCreated: "Jan-14, 2024",
      status: "Active",
    },
  ];

  const topDonorsByState: TopDonorByState[] = [
    { id: "1", name: "Utah", visits: 4243, lastVisit: "Jan-14, 2024" },
    { id: "2", name: "Washington", visits: 3423, lastVisit: "Jan-14, 2024" },
    { id: "3", name: "Illinois", visits: 456, lastVisit: "Jan-14, 2024" },
    { id: "4", name: "New York", visits: 214, lastVisit: "Jan-14, 2024" },
    { id: "5", name: "California", visits: 123, lastVisit: "Jan-14, 2024" },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusBadge = (status: "Active" | "Pending" | "Inactive") => {
    switch (status) {
      case "Active":
        return <Badge variant="success">{status}</Badge>;
      case "Pending":
        return <Badge variant="warning">{status}</Badge>;
      case "Inactive":
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleRefresh = () => {
    // Refresh data logic
    console.log("Refreshing data...");
  };

  const handleImportExport = () => {
    console.log("Import/Export clicked");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Date Period Filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Dropdown
          label={`Last Period: ${selectedPeriod}`}
          selectedValue={`Last Period: ${selectedPeriod}`}
          className="w-full sm:w-auto"
        >
          {months.map((month) => (
            <DropdownItem
              key={month}
              onClick={() => setSelectedPeriod(month)}
              className={selectedPeriod === month ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              {month}
            </DropdownItem>
          ))}
        </Dropdown>
        <button
          onClick={handleRefresh}
          className="cursor-pointer rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">No. of Donations</p>
          <p className="mt-2 text-2xl font-semibold">{kpiData.donations.toLocaleString()}</p>
          <p className="mt-1 text-sm text-green-600 font-medium">
            +{kpiData.changePercentage}% from last period
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Donation Amount</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(kpiData.donationAmount)}</p>
          <p className="mt-1 text-sm text-green-600 font-medium">
            +{kpiData.changePercentage}% from last period
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">No. of Accounts Created</p>
          <p className="mt-2 text-2xl font-semibold">{kpiData.accountsCreated}</p>
          <p className="mt-1 text-sm text-green-600 font-medium">
            +{kpiData.changePercentage}% from last period
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">No. of Posts Created</p>
          <p className="mt-2 text-2xl font-semibold">{kpiData.postsCreated}</p>
          <p className="mt-1 text-sm text-green-600 font-medium">
            +{kpiData.changePercentage}% from last period
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Dropdown
              label="Donation Amount"
              selectedValue="Donation Amount"
              className="w-auto"
            >
              <DropdownItem onClick={() => {}}>Donation Amount</DropdownItem>
              <DropdownItem onClick={() => {}}>No. of Donations</DropdownItem>
              <DropdownItem onClick={() => {}}>Accounts Created</DropdownItem>
              <DropdownItem onClick={() => {}}>Posts Created</DropdownItem>
            </Dropdown>
            <p className="text-sm text-green-600 font-medium">
              +{kpiData.changePercentage}% from last period
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-zinc-200 overflow-hidden">
              <button
                onClick={() => setChartView("daily")}
                className={`cursor-pointer px-3 py-1.5 text-sm font-medium transition-colors ${
                  chartView === "daily"
                    ? "bg-brand-yellow text-black"
                    : "bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setChartView("weekly")}
                className={`cursor-pointer border-l border-zinc-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                  chartView === "weekly"
                    ? "bg-brand-yellow text-black"
                    : "bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Weekly
              </button>
            </div>
            <Button
              variant="primary"
              className="text-sm px-3 py-2 flex items-center gap-2"
              onClick={handleImportExport}
            >
              <Upload className="h-4 w-4" />
              <Download className="h-4 w-4" />
              Import / Export
            </Button>
          </div>
        </div>
        <div className="h-64 md:h-80">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Data Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Visited Agencies */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold">Top Visited Agencies</h3>
            <div className="flex items-center gap-2">
              <Dropdown
                label={tablePeriod}
                selectedValue={tablePeriod}
                className="w-auto"
              >
                <DropdownItem onClick={() => setTablePeriod("This Month")}>
                  This Month
                </DropdownItem>
                <DropdownItem onClick={() => setTablePeriod("This Week")}>
                  This Week
                </DropdownItem>
                <DropdownItem onClick={() => setTablePeriod("This Year")}>
                  This Year
                </DropdownItem>
              </Dropdown>
              <Button
                variant="secondary"
                className="text-xs px-2 py-1 flex items-center gap-1"
                onClick={() => console.log("View all agencies")}
              >
                View All
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Last Activity
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Date Created
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {topVisitedAgencies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No data available
                    </td>
                  </tr>
                ) : (
                  topVisitedAgencies.map((agency) => (
                    <tr key={agency.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                        {agency.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {agency.lastActivity}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {agency.dateCreated}
                      </td>
                      <td className="px-4 py-2 text-sm">{getStatusBadge(agency.status)}</td>
                      <td className="px-4 py-2 text-right">
                        <button className="cursor-pointer rounded p-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Visitors By State */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold">Top Visitors By State</h3>
            <div className="flex items-center gap-2">
              <Dropdown
                label={tablePeriod}
                selectedValue={tablePeriod}
                className="w-auto"
              >
                <DropdownItem onClick={() => setTablePeriod("This Month")}>
                  This Month
                </DropdownItem>
                <DropdownItem onClick={() => setTablePeriod("This Week")}>
                  This Week
                </DropdownItem>
                <DropdownItem onClick={() => setTablePeriod("This Year")}>
                  This Year
                </DropdownItem>
              </Dropdown>
              <Button
                variant="secondary"
                className="text-xs px-2 py-1 flex items-center gap-1"
                onClick={() => console.log("View all visitors")}
              >
                View All
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    No. of Visits
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Last Visit
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {topVisitorsByState.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No data available
                    </td>
                  </tr>
                ) : (
                  topVisitorsByState.map((visitor) => (
                    <tr key={visitor.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                        {visitor.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                        {visitor.visits.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {visitor.lastVisit}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button className="cursor-pointer rounded p-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Visited Churches */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold">Top Visited Churches</h3>
            <div className="flex items-center gap-2">
              <Dropdown
                label={tablePeriod}
                selectedValue={tablePeriod}
                className="w-auto"
              >
                <DropdownItem onClick={() => setTablePeriod("This Month")}>
                  This Month
                </DropdownItem>
                <DropdownItem onClick={() => setTablePeriod("This Week")}>
                  This Week
                </DropdownItem>
                <DropdownItem onClick={() => setTablePeriod("This Year")}>
                  This Year
                </DropdownItem>
              </Dropdown>
              <Button
                variant="secondary"
                className="text-xs px-2 py-1 flex items-center gap-1"
                onClick={() => console.log("View all churches")}
              >
                View All
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Last Activity
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Date Created
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {topVisitedChurches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No data available
                    </td>
                  </tr>
                ) : (
                  topVisitedChurches.map((church) => (
                    <tr key={church.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                        {church.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {church.lastActivity}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {church.dateCreated}
                      </td>
                      <td className="px-4 py-2 text-sm">{getStatusBadge(church.status)}</td>
                      <td className="px-4 py-2 text-right">
                        <button className="cursor-pointer rounded p-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Donors By State */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold">Top Donors By State</h3>
            <div className="flex items-center gap-2">
              <Dropdown
                label={tablePeriod}
                selectedValue={tablePeriod}
                className="w-auto"
              >
                <DropdownItem onClick={() => setTablePeriod("This Month")}>
                  This Month
                </DropdownItem>
                <DropdownItem onClick={() => setTablePeriod("This Week")}>
                  This Week
                </DropdownItem>
                <DropdownItem onClick={() => setTablePeriod("This Year")}>
                  This Year
                </DropdownItem>
              </Dropdown>
              <Button
                variant="secondary"
                className="text-xs px-2 py-1 flex items-center gap-1"
                onClick={() => console.log("View all donors")}
              >
                View All
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    No. of Visits
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Last Visit
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {topDonorsByState.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No data available
                    </td>
                  </tr>
                ) : (
                  topDonorsByState.map((donor) => (
                    <tr key={donor.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                        {donor.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                        {donor.visits.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {donor.lastVisit}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button className="cursor-pointer rounded p-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
