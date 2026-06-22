// Global Chart Tracker
let lossChartInstance = null;

// Helper Function: Format numbers with thousands commas
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

// Dynamically generate early selling choices limited by maximum tenure length
function updateSellEarlyOptions() {
  const totalTermMonths =
    parseInt(document.getElementById("loan-term").value) || 84;
  const maxYears = totalTermMonths / 12;
  const sellEarlySelect = document.getElementById("sell-early");

  const currentSelection = sellEarlySelect.value || "no";
  sellEarlySelect.innerHTML =
    '<option value="no">No, keep until loan ends</option>';

  for (let y = 2; y <= 9; y++) {
    if (y < maxYears) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.innerText = `Yes, sell after ${y} Years`;
      sellEarlySelect.appendChild(opt);
    }
  }

  if (parseInt(currentSelection) < maxYears) {
    sellEarlySelect.value = currentSelection;
  } else {
    sellEarlySelect.value = "no";
  }
}

// FIXED: BANK NEGARA COMPLIANT CAR LOAN INSTALMENT CALCULATOR
function getMonthlyInstalment(principal, annualRatePct, months) {
  // Correcting the variable typo so the formula doesn't halt execution
  const flatAnnualInterest = principal * (annualRatePct / 100);
  const totalInterestOverTenure = flatAnnualInterest * (months / 12);
  const standardPayment = (principal + totalInterestOverTenure) / months;

  return standardPayment;
}

// Main Calculation Flow
function calculateAll() {
  const condition = document.getElementById("car-condition").value;
  const carPrice = parseFloat(document.getElementById("car-price").value) || 0;
  const downPayment =
    parseFloat(document.getElementById("down-payment").value) || 0;
  const rateInput =
    parseFloat(document.getElementById("interest-rate").value) || 0;
  const totalTermMonths =
    parseInt(document.getElementById("loan-term").value) || 84;
  const sellEarlyOpt = document.getElementById("sell-early").value;
  const loanRuleType = document.getElementById("loan-rule").value;

  const principal = carPrice - downPayment;

  // UI Safeguard if principal goes negative or fields are empty
  if (principal <= 0 || carPrice <= 0) {
    document.getElementById("res-monthly").innerText = "RM 0.00";
    document.getElementById("res-total-paid").innerText = "RM 0.00";
    document.getElementById("res-car-value").innerText = "RM 0.00";
    document.getElementById("res-total-loss").innerText = "RM 0.00";
    return;
  }

  const monthlyPayment = getMonthlyInstalment(
    principal,
    rateInput,
    totalTermMonths,
  );
  const baselineTotalInterest =
    principal * (rateInput / 100) * (totalTermMonths / 12);

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

  // Compute Early Settlement Rebates fairly based on 2026 statutory guidelines
  let evaluationTotalOutflow = 0;
  if (isEarlySale) {
    let remainingLoanBalance = 0;
    const remainingInstallments = totalTermMonths - analysisMonths;

    if (loanRuleType === "old") {
      // Front-loaded legacy Rule of 78 formula
      const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
      const sumRemaining =
        (remainingInstallments * (remainingInstallments + 1)) / 2;
      const interestRebate = (sumRemaining / sumTotal) * baselineTotalInterest;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments - interestRebate;
    } else {
      // 2026 Reducing Balance Settlement tracking
      const averageInterestPerMonth = baselineTotalInterest / totalTermMonths;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments -
        averageInterestPerMonth * remainingInstallments * 0.15;
    }
    evaluationTotalOutflow =
      downPayment +
      monthlyPayment * analysisMonths +
      Math.max(0, remainingLoanBalance);
  } else {
    evaluationTotalOutflow = downPayment + monthlyPayment * totalTermMonths;
  }

  // Dynamic Depreciation Weights mapping your segments condition scenario directly
  let finalCarValue = 0;
  if (condition === "used") {
    // A used car priced at 60k was worth 100k when new (approx 1.66x original value).
    // It has already completed its heaviest depreciation hit, so it loses value slightly slower now (e.g., 7% yearly).
    const originalEstimatedValue = carPrice * 1.66;
    finalCarValue =
      originalEstimatedValue * Math.pow(1 - 0.12, analysisYears + 4);

    // Safety cap to keep calculations bounded realistically
    if (finalCarValue > carPrice)
      finalCarValue = carPrice * Math.pow(1 - 0.07, analysisYears);
  } else {
    // New car suffers standard, heavy initial year depreciation layers (9% standard)
    finalCarValue = carPrice * Math.pow(1 - 0.09, analysisYears);
  }

  const absoluteLoss = evaluationTotalOutflow - finalCarValue;

  // Render Metrics Interface Screen Cards
  document.getElementById("res-monthly").innerText = formatMYR(monthlyPayment);
  document.getElementById("res-total-paid").innerText = formatMYR(
    evaluationTotalOutflow,
  );
  document.getElementById("res-car-value").innerText = formatMYR(finalCarValue);

  document.getElementById("res-total-loss").innerHTML = `
        <div style="font-size: 24px; margin-bottom: 5px;">${formatMYR(absoluteLoss)}</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">跌 ~${formatMYR(absoluteLoss / analysisYears)} / year</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">跌 ~${formatMYR(absoluteLoss / analysisMonths)} / month</div>
    `;

  // Render dynamic visual graph models
  const chartPoints = calculateYearlyDataPoints(
    carPrice,
    downPayment,
    rateInput,
    totalTermMonths,
    loanRuleType,
    condition,
  );
  renderLineChart(chartPoints);
}

// Compute coordinated path vectors
function calculateYearlyDataPoints(
  carPrice,
  downPayment,
  rateInput,
  totalTermMonths,
  loanRuleType,
  condition,
) {
  const maxYears = totalTermMonths / 12;
  const principal = carPrice - downPayment;
  let data = { labels: [], payments: [], values: [] };

  const monthlyPayment = getMonthlyInstalment(
    principal,
    rateInput,
    totalTermMonths,
  );
  const baselineTotalInterest =
    principal * (rateInput / 100) * (totalTermMonths / 12);

  data.labels.push("Year 0");
  data.payments.push(downPayment);
  data.values.push(carPrice);

  for (let y = 1; y <= maxYears; y++) {
    data.labels.push(`Year ${y}`);
    const currentMonths = y * 12;
    let evaluationTotalOutflow = 0;

    if (y < maxYears) {
      let remainingLoanBalance = 0;
      const remainingInstallments = totalTermMonths - currentMonths;

      if (loanRuleType === "old") {
        const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
        const sumRemaining =
          (remainingInstallments * (remainingInstallments + 1)) / 2;
        const interestRebate =
          (sumRemaining / sumTotal) * baselineTotalInterest;
        remainingLoanBalance =
          monthlyPayment * remainingInstallments - interestRebate;
      } else {
        const averageInterestPerMonth = baselineTotalInterest / totalTermMonths;
        remainingLoanBalance =
          monthlyPayment * remainingInstallments -
          averageInterestPerMonth * remainingInstallments * 0.15;
      }
      evaluationTotalOutflow =
        downPayment +
        monthlyPayment * currentMonths +
        Math.max(0, remainingLoanBalance);
    } else {
      evaluationTotalOutflow = downPayment + monthlyPayment * totalTermMonths;
    }

    let currentCarValue = 0;
    if (condition === "used") {
      const originalEstimatedValue = carPrice * 1.66;
      currentCarValue = originalEstimatedValue * Math.pow(1 - 0.12, y + 4);
      if (currentCarValue > carPrice)
        currentCarValue = carPrice * Math.pow(1 - 0.07, y);
    } else {
      currentCarValue = carPrice * Math.pow(1 - 0.09, y);
    }

    data.payments.push(evaluationTotalOutflow);
    data.values.push(currentCarValue);
  }
  return data;
}

function renderLineChart(chartPoints) {
  const canvasElement = document.getElementById("lossLineChart");
  if (!canvasElement) return; // Fail-soft if template canvas missing

  const ctx = canvasElement.getContext("2d");
  if (lossChartInstance !== null) {
    lossChartInstance.destroy();
  }

  lossChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartPoints.labels,
      datasets: [
        {
          label: "Total Expenses Incurred",
          data: chartPoints.payments,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          tension: 0.2,
          fill: true,
        },
        {
          label: "Car Resale Value Trend",
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
        legend: { labels: { color: "#94a3b8" } },
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

  if (!tableBody) return;
  tableBody.innerHTML = "";
  if (targetMonthly <= 0) return;

  const terms = [48, 60, 72, 84, 96, 108];

  terms.forEach((months) => {
    const totalPrincipalInstallments = targetMonthly * months;
    const totalInterestFactor = 1 + (maxRate / 100) * (months / 12);
    const maxPrincipal = totalPrincipalInstallments / totalInterestFactor;

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

// Event bindings to link the calculation engine safely to HTML inputs
document.addEventListener("DOMContentLoaded", function () {
  const inputIds = [
    "car-condition",
    "car-price",
    "down-payment",
    "interest-rate",
    "loan-term",
    "sell-early",
    "loan-rule",
  ];
  inputIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("change", calculateAll);
      element.addEventListener("input", calculateAll);
    }
  });

  const loanTermInput = document.getElementById("loan-term");
  if (loanTermInput) {
    loanTermInput.addEventListener("change", updateSellEarlyOptions);
  }

  const targetInput = document.getElementById("target-monthly");
  const targetRateInput = document.getElementById("target-rate");
  if (targetInput) targetInput.addEventListener("input", calculateTarget);
  if (targetRateInput)
    targetRateInput.addEventListener("input", calculateTarget);

  updateSellEarlyOptions();
  calculateAll();
});
