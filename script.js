// Global Chart Variable Tracker
let lossChartInstance = null;

// Helper Function: Format numbers with thousands commas and 2 decimals
function formatMYR(num) {
  return (
    "RM " +
    num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Tab Switching System
function switchTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((el) => el.classList.remove("active"));

  if (tabName === "analysis") {
    document.getElementById("analysis-tab").classList.add("active");
    document
      .querySelector("button[onclick*='analysis']")
      .classList.add("active");
    calculateAll();
  } else {
    document.getElementById("target-tab").classList.add("active");
    document.querySelector("button[onclick*='target']").classList.add("active");
    calculateTarget();
  }
}

// Dynamically generate early selling dropdown listings limited by maximum tenure length
function updateSellEarlyOptions() {
  const totalTermMonths = parseInt(document.getElementById("loan-term").value);
  const maxYears = totalTermMonths / 12;
  const sellEarlySelect = document.getElementById("sell-early");

  // Cache current selection to restore if valid
  const currentSelection = sellEarlySelect.value || "no";
  sellEarlySelect.innerHTML =
    '<option value="no">No, keep until loan ends</option>';

  // Add valid selling choices starting from 2 years up to strict (maxYears - 1) cutoff bounds
  for (let y = 2; y <= 8; y++) {
    if (y < maxYears) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.innerText = `Yes, sell after ${y} Years`;
      sellEarlySelect.appendChild(opt);
    }
  }

  // Reset selection safely if old parameter value falls out of range
  if (parseInt(currentSelection) < maxYears) {
    sellEarlySelect.value = currentSelection;
  } else {
    sellEarlySelect.value = "no";
  }
}

// Convert Flat Rate to Effective Interest Rate (EIR) for accurate Reducing Balance mapping
function flatToEIR(flatRate, months) {
  if (flatRate === 0) return 0;
  const t = months / 12;
  const totalInterest = flatRate * t;
  return (2 * months * totalInterest) / (months * (1 + totalInterest) + 100);
}

// Compute single point coordinates array to cleanly generate trendline structures
function calculateYearlyDataPoints(
  carPrice,
  downPayment,
  rateInput,
  totalTermMonths,
  loanRuleType,
) {
  const maxYears = totalTermMonths / 12;
  const principal = carPrice - downPayment;
  let data = { labels: [], payments: [], values: [] };

  let monthlyPayment = 0;
  let totalInterestPaid = 0;

  if (loanRuleType === "old") {
    const annualizedInterest = principal * (rateInput / 100);
    totalInterestPaid = annualizedInterest * (totalTermMonths / 12);
    monthlyPayment = (principal + totalInterestPaid) / totalTermMonths;
  } else {
    const estimatedEIR = flatToEIR(rateInput / 100, totalTermMonths);
    const monthlyRate = estimatedEIR / 12;
    monthlyPayment =
      monthlyRate === 0
        ? principal / totalTermMonths
        : (principal *
            (monthlyRate * Math.pow(1 + monthlyRate, totalTermMonths))) /
          (Math.pow(1 + monthlyRate, totalTermMonths) - 1);
    totalInterestPaid = monthlyPayment * totalTermMonths - principal;
  }

  // Always include Year 0 base start boundaries
  data.labels.push("Year 0");
  data.payments.push(downPayment);
  data.values.push(carPrice);

  for (let y = 1; y <= maxYears; y++) {
    data.labels.push(`Year ${y}`);

    let evaluationTotalOutflow = 0;
    const currentMonths = y * 12;

    if (y < maxYears) {
      let remainingLoanBalance = 0;
      if (loanRuleType === "old") {
        const remainingInstallments = totalTermMonths - currentMonths;
        const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
        const sumRemaining =
          (remainingInstallments * (remainingInstallments + 1)) / 2;
        const interestRebate = (sumRemaining / sumTotal) * totalInterestPaid;
        remainingLoanBalance =
          monthlyPayment * remainingInstallments - interestRebate;
      } else {
        const estimatedEIR = flatToEIR(rateInput / 100, totalTermMonths);
        const monthlyRate = estimatedEIR / 12;
        remainingLoanBalance = principal;
        for (let m = 0; m < currentMonths; m++) {
          remainingLoanBalance -=
            monthlyPayment - remainingLoanBalance * monthlyRate;
        }
      }
      evaluationTotalOutflow =
        downPayment +
        monthlyPayment * currentMonths +
        Math.max(0, remainingLoanBalance);
    } else {
      evaluationTotalOutflow = downPayment + monthlyPayment * totalTermMonths;
    }

    const currentCarValue = carPrice * Math.pow(1 - 0.09, y);
    data.payments.push(evaluationTotalOutflow);
    data.values.push(currentCarValue);
  }
  return data;
}

// Main Calculation Flow
function calculateAll() {
  const carPrice = parseFloat(document.getElementById("car-price").value) || 0;
  const downPayment =
    parseFloat(document.getElementById("down-payment").value) || 0;
  const rateInput =
    parseFloat(document.getElementById("interest-rate").value) || 0;
  const totalTermMonths = parseInt(document.getElementById("loan-term").value);
  const sellEarlyOpt = document.getElementById("sell-early").value;
  const loanRuleType = document.getElementById("loan-rule").value;

  const principal = carPrice - downPayment;
  if (principal <= 0 || carPrice <= 0) return;

  let monthlyPayment = 0;
  let totalPaidOverTenure = 0;
  let totalInterestPaid = 0;

  if (loanRuleType === "old") {
    const annualizedInterest = principal * (rateInput / 100);
    totalInterestPaid = annualizedInterest * (totalTermMonths / 12);
    totalPaidOverTenure = principal + totalInterestPaid;
    monthlyPayment = totalPaidOverTenure / totalTermMonths;
  } else {
    const estimatedEIR = flatToEIR(rateInput / 100, totalTermMonths);
    const monthlyRate = estimatedEIR / 12;
    monthlyPayment =
      monthlyRate === 0
        ? principal / totalTermMonths
        : (principal *
            (monthlyRate * Math.pow(1 + monthlyRate, totalTermMonths))) /
          (Math.pow(1 + monthlyRate, totalTermMonths) - 1);
    totalPaidOverTenure = monthlyPayment * totalTermMonths;
    totalInterestPaid = totalPaidOverTenure - principal;
  }

  const isEarlySale = sellEarlyOpt !== "no";
  const analysisYears = isEarlySale
    ? parseInt(sellEarlyOpt)
    : totalTermMonths / 12;
  const analysisMonths = analysisYears * 12;

  document.getElementById("label-total-paid").innerText = isEarlySale
    ? `Total Paid up to Year ${analysisYears}`
    : "Total Paid over Tenure";
  document.getElementById("label-car-value").innerText =
    `Car Value at Year ${analysisYears}`;

  let evaluationTotalOutflow = 0;
  if (isEarlySale) {
    let remainingLoanBalance = 0;
    if (loanRuleType === "old") {
      const remainingInstallments = totalTermMonths - analysisMonths;
      const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
      const sumRemaining =
        (remainingInstallments * (remainingInstallments + 1)) / 2;
      const interestRebate = (sumRemaining / sumTotal) * totalInterestPaid;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments - interestRebate;
    } else {
      const estimatedEIR = flatToEIR(rateInput / 100, totalTermMonths);
      const monthlyRate = estimatedEIR / 12;
      remainingLoanBalance = principal;
      for (let m = 0; m < analysisMonths; m++) {
        remainingLoanBalance -=
          monthlyPayment - remainingLoanBalance * monthlyRate;
      }
    }
    evaluationTotalOutflow =
      downPayment +
      monthlyPayment * analysisMonths +
      Math.max(0, remainingLoanBalance);
  } else {
    evaluationTotalOutflow = downPayment + totalPaidOverTenure;
  }

  const finalCarValue = carPrice * Math.pow(1 - 0.09, analysisYears);
  const absoluteLoss = evaluationTotalOutflow - finalCarValue;

  document.getElementById("res-monthly").innerText = formatMYR(monthlyPayment);
  document.getElementById("res-total-paid").innerText = formatMYR(
    evaluationTotalOutflow,
  );
  document.getElementById("res-car-value").innerText = formatMYR(finalCarValue);

  document.getElementById("res-total-loss").innerHTML = `
        <div style="font-size: 24px; margin-bottom: 5px;">${formatMYR(absoluteLoss)}</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(absoluteLoss / analysisYears)} / year</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(absoluteLoss / analysisMonths)} / month</div>
    `;

  // 8. Generate Line Graph Component Elements
  const chartPoints = calculateYearlyDataPoints(
    carPrice,
    downPayment,
    rateInput,
    totalTermMonths,
    loanRuleType,
  );
  renderLineChart(chartPoints);
}

// Construct and Render Vector Trends utilizing ChartJS context configurations
function renderLineChart(chartPoints) {
  const ctx = document.getElementById("lossLineChart").getContext("2d");

  // Wipe previous canvas configurations cleanly if they exist
  if (lossChartInstance !== null) {
    lossChartInstance.destroy();
  }

  lossChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartPoints.labels,
      datasets: [
        {
          label: "Total Expenses Incurred (Cumulative Cost)",
          data: chartPoints.payments,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          tension: 0.2,
          fill: true,
        },
        {
          label: "Depreciating Asset Real-Value",
          data: chartPoints.values,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" }, position: "top" },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.dataset.label + ": " + formatMYR(context.parsed.y);
            },
          },
        },
      },
      scales: {
        x: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
        y: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
      },
    },
  });
}

function calculateTarget() {
  const targetMonthly =
    parseFloat(document.getElementById("target-monthly").value) || 0;
  const maxRate = parseFloat(document.getElementById("target-rate").value) || 0;
  const tableBody = document.getElementById("target-table-body");

  tableBody.innerHTML = "";
  if (targetMonthly <= 0) return;

  const terms = [48, 60, 72, 84, 96, 108];

  terms.forEach((months) => {
    const estimatedEIR = flatToEIR(maxRate / 100, months);
    const monthlyRate = estimatedEIR / 12;

    let maxPrincipal = 0;
    if (monthlyRate === 0) {
      maxPrincipal = targetMonthly * months;
    } else {
      maxPrincipal =
        targetMonthly /
        ((monthlyRate * Math.pow(1 + monthlyRate, months)) /
          (Math.pow(1 + monthlyRate, months) - 1));
    }

    const maxCarPrice = maxPrincipal / 0.9;
    const totalInterest = targetMonthly * months - maxPrincipal;

    const row = document.createElement("tr");
    row.innerHTML = `
            <td><strong>${months / 12} Years</strong> (${months} mos)</td>
            <td class="text-green">${formatMYR(maxCarPrice)}</td>
            <td class="text-red">${formatMYR(totalInterest)}</td>
        `;
    tableBody.appendChild(row);
  });
}

// Initial bootstrap execution configuration bounds
window.onload = function () {
  updateSellEarlyOptions();
  calculateAll();
};
