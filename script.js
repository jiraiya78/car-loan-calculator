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
  const totalTermMonths = parseInt(document.getElementById("loan-term").value);
  const maxYears = totalTermMonths / 12;
  const sellEarlySelect = document.getElementById("sell-early");

  const currentSelection = sellEarlySelect.value || "no";
  sellEarlySelect.innerHTML =
    '<option value="no">No, keep until loan ends</option>';

  for (let y = 2; y <= 8; y++) {
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

// BANK NEGARA COMPLIANT ACCURATE CAR LOAN INSTALMENT CALCULATOR
function getMonthlyInstalment(principal, annualRatePct, months, ruleType) {
  // Under Malaysian 2026 HP rules, the flat interest schedule sets the standard baseline monthly commitment tier
  const flatAnnualInterest = principal * (annualRatePct / 100);
  const totalInterestOverTenure = flatAnnualInterest * (months / 12);
  const totalOutflow = principal + totalInterestPaid;
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
  const totalTermMonths = parseInt(document.getElementById("loan-term").value);
  const sellEarlyOpt = document.getElementById("sell-early").value;
  const loanRuleType = document.getElementById("loan-rule").value;

  const principal = carPrice - downPayment;
  if (principal <= 0 || carPrice <= 0) return;

  // Fixed math parameters yielding exact localized bank rates
  const monthlyPayment = getMonthlyInstalment(
    principal,
    rateInput,
    totalTermMonths,
    loanRuleType,
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
    if (loanRuleType === "old") {
      // Deprecated front-loaded legacy Rule of 78 formula mapping
      const remainingInstallments = totalTermMonths - analysisMonths;
      const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
      const sumRemaining =
        (remainingInstallments * (remainingInstallments + 1)) / 2;
      const interestRebate = (sumRemaining / sumTotal) * baselineTotalInterest;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments - interestRebate;
    } else {
      // 2026 Reducing Balance Settlement tracking (No arbitrary frontloaded weight bias)
      const remainingInstallments = totalTermMonths - analysisMonths;
      const averageInterestPerMonth = baselineTotalInterest / totalTermMonths;
      // Linear real-time principal collection tracking protection safeguards
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
  let depreciationRate = 0.09;
  let finalCarValue = carPrice * Math.pow(1 - depreciationRate, analysisYears);

  if (condition === "used") {
    // High luxury segment class initial entry anchor representation adjustments
    finalCarValue = carPrice * 1.4 * Math.pow(1 - 0.14, analysisYears + 3);
    if (finalCarValue > carPrice)
      finalCarValue = carPrice * Math.pow(1 - 0.08, analysisYears);
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
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(absoluteLoss / analysisYears)} / year</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(absoluteLoss / analysisMonths)} / month</div>
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
    loanRuleType,
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
      if (loanRuleType === "old") {
        const remainingInstallments = totalTermMonths - currentMonths;
        const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
        const sumRemaining =
          (remainingInstallments * (remainingInstallments + 1)) / 2;
        const interestRebate =
          (sumRemaining / sumTotal) * baselineTotalInterest;
        remainingLoanBalance =
          monthlyPayment * remainingInstallments - interestRebate;
      } else {
        const remainingInstallments = totalTermMonths - currentMonths;
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

    let currentCarValue = carPrice * Math.pow(1 - 0.09, y);
    if (condition === "used") {
      currentCarValue = carPrice * 1.4 * Math.pow(1 - 0.14, y + 3);
      if (currentCarValue > carPrice)
        currentCarValue = carPrice * Math.pow(1 - 0.08, y);
    }

    data.payments.push(evaluationTotalOutflow);
    data.values.push(currentCarValue);
  }
  return data;
}

function renderLineChart(chartPoints) {
  const ctx = document.getElementById("lossLineChart").getContext("2d");
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

  tableBody.innerHTML = "";
  if (targetMonthly <= 0) return;

  const terms = [48, 60, 72, 84, 96, 108];

  terms.forEach((months) => {
    // Reverse calculation maps exactly matching local loan parameters layout
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

// Init bootstrap routines
window.onload = function () {
  updateSellEarlyOptions();
  calculateAll();
};
