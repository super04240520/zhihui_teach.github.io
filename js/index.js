const KNOWLEDGE_BUBBLES = window.KNOWLEDGE_BUBBLES || [
  {
    id: 1,
    name: "专业化介绍",
    category: "取信三要素",
    question:
      "“取信三要素”中，让客户觉得你非常懂行、有资质、能解决痛点，指的是哪一个要素？",
    answer: "专业化介绍",
    points: 2,
  },
  {
    id: 2,
    name: "第三方评价",
    category: "取信三要素",
    question:
      "取信三要素里，利用客户见证、成功案例、行业认证来建立信任，被称为？",
    answer: "第三方评价",
    points: 2,
  },
  {
    id: 3,
    name: "场景化介绍",
    category: "取信三要素",
    question:
      "用具体画面描绘产品使用后的效果，让客户“看见”价值，这属于取信三要素中的？",
    answer: "场景化介绍",
    points: 2,
  },
  {
    id: 4,
    name: "锚点效应",
    category: "促单三心理",
    question:
      "先展示高价产品作为对比，让主推产品显得更划算，这种影响客户决策的心理效应叫做？",
    answer: "锚点效应",
    points: 2,
  },
  {
    id: 5,
    name: "损失厌恶",
    category: "促单三心理",
    question:
      "人们面对同样数量的收益和损失时，认为损失更加难以忍受。这种心理称为？",
    answer: "损失厌恶",
    points: 2,
  },
  {
    id: 6,
    name: "心理暗示",
    category: "促单三心理",
    question:
      "通过语言、动作、环境等间接影响客户潜意识，使其不自觉地接受观点，这种心理技巧称为？",
    answer: "心理暗示",
    points: 2,
  },
  {
    id: 7,
    name: "YES 认可观点",
    category: "促单逻辑",
    question:
      "YAB促单逻辑中，第一步需要先表示理解和认同客户，这一步通常称为？(提示：英文单词)",
    answer: "yes",
    points: 2,
  },
  {
    id: 8,
    name: "AND 解释疑问",
    category: "促单逻辑",
    question:
      "在YAB逻辑框架里，对客户疑问加以延伸解释、提供更多信息的是哪个词？",
    answer: "and",
    points: 2,
  },
  {
    id: 9,
    name: "BUT 转折下单",
    category: "促单逻辑",
    question:
      "YAB最后一步，温和而坚定地引导客户成交或采取行动，使用哪个转折词？",
    answer: "but",
    points: 2,
  },
];

// 游戏状态
let activeBubbles = [];
let currentScore = 0;
let currentSelectedBubble = null;

// DOM 元素
const bubblesGrid = document.getElementById("bubblesGrid");
const scoreSpan = document.getElementById("scoreValue");
const bubblesCountSpan = document.getElementById("bubblesCount");
const resetBtn = document.getElementById("resetGameBtn");
const modal = document.getElementById("questionModal");
const modalBubbleNameSpan = document.getElementById("modalBubbleName");
const modalQuestionDiv = document.getElementById("modalQuestion");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitAnswerBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalFeedback = document.getElementById("modalFeedback");

function updateUI() {
  scoreSpan.innerText = currentScore;
  bubblesCountSpan.innerText = activeBubbles.length;
  renderBubbles();

  if (activeBubbles.length === 0) {
    let winDiv = document.querySelector(".win-toast-sales");
    if (!winDiv) {
      const msg = document.createElement("div");
      msg.className = "win-message win-toast-sales";
      msg.innerHTML =
        "🏆 恭喜完成入职必修课！<br>✅ 掌握取信三要素、促单三心理 & YAB 逻辑<br>获得全部入职积分！";
      bubblesGrid.parentNode.insertBefore(msg, bubblesGrid.nextSibling);
    }
  } else {
    const existingWin = document.querySelector(".win-toast-sales");
    if (existingWin) existingWin.remove();
  }
}

function renderBubbles() {
  bubblesGrid.innerHTML = "";
  if (activeBubbles.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-state";
    emptyDiv.innerHTML = "✨ 所有入职技能均已点亮！<br>点击重置继续强化肌肉记忆";
    bubblesGrid.appendChild(emptyDiv);
    return;
  }

  activeBubbles.forEach((bubble) => {
    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "bubble";
    bubbleDiv.setAttribute("data-type", bubble.category);
    bubbleDiv.innerHTML = `
        <div class="bubble-dot"></div>
        <div class="bubble-name">${escapeHtml(bubble.name)}</div>
        <div class="bubble-cat">${escapeHtml(bubble.category)}</div>
        <div class="bubble-pts">+${bubble.points} PTS</div>
    `;
    bubbleDiv.addEventListener("click", (e) => {
      e.stopPropagation();
      currentSelectedBubble = bubble;
      openModalForBubble(bubble);
    });
    bubblesGrid.appendChild(bubbleDiv);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function (m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

function openModalForBubble(bubble) {
  if (!bubble) return;
  modalBubbleNameSpan.innerHTML = `📘 &nbsp;${escapeHtml(bubble.name)} &nbsp;·&nbsp; ${escapeHtml(bubble.category)}`;
  modalQuestionDiv.innerText = bubble.question;
  answerInput.value = "";
  modalFeedback.innerHTML = "";
  modalFeedback.style.color = "";
  modal.style.display = "flex";
  answerInput.focus();
}

function handleAnswerSubmission() {
  if (!currentSelectedBubble) {
    closeModal();
    return;
  }
  const userAnswer = answerInput.value.trim().toLowerCase();
  const correctAnswer = currentSelectedBubble.answer.toLowerCase();

  let isMatch = false;
  if (userAnswer === correctAnswer) {
    isMatch = true;
  } else {
    const bubbleName = currentSelectedBubble.name;
    if (
      bubbleName === "YES 认可观点" &&
      (userAnswer === "yes" ||
        userAnswer === "是" ||
        userAnswer === "认可观点")
    )
      isMatch = true;
    else if (
      bubbleName === "AND 解释疑问" &&
      (userAnswer === "and" ||
        userAnswer === "并且" ||
        userAnswer === "解释疑问")
    )
      isMatch = true;
    else if (
      bubbleName === "BUT 转折下单" &&
      (userAnswer === "but" ||
        userAnswer === "但是" ||
        userAnswer === "转折下单")
    )
      isMatch = true;
    else if (
      bubbleName === "锚点效应" &&
      (userAnswer === "锚定效应" || userAnswer === "锚点")
    )
      isMatch = true;
    else if (
      bubbleName === "损失厌恶" &&
      (userAnswer === "损失规避" || userAnswer === "损失厌恶心理")
    )
      isMatch = true;
    else if (
      bubbleName === "心理暗示" &&
      (userAnswer === "暗示" || userAnswer === "心理暗示法")
    )
      isMatch = true;
    else if (
      bubbleName === "专业化介绍" &&
      (userAnswer === "专业介绍" || userAnswer === "专业形象")
    )
      isMatch = true;
    else if (
      bubbleName === "第三方评价" &&
      (userAnswer === "第三方背书" || userAnswer === "客户评价")
    )
      isMatch = true;
    else if (
      bubbleName === "场景化介绍" &&
      (userAnswer === "场景介绍" || userAnswer === "场景化")
    )
      isMatch = true;
  }

  if (isMatch) {
    const earned = currentSelectedBubble.points;
    currentScore += earned;
    const idx = activeBubbles.findIndex((b) => b.id === currentSelectedBubble.id);
    if (idx !== -1) activeBubbles.splice(idx, 1);
    modalFeedback.innerHTML = `✅ 漂亮！"${escapeHtml(currentSelectedBubble.name)}" 掌握到位！+${earned} 入职积分 🎉`;
    modalFeedback.style.color = "var(--c3)";
    setTimeout(() => {
      closeModal();
      updateUI();
      currentSelectedBubble = null;
    }, 800);
  } else {
    modalFeedback.innerHTML = `❌ 答案"${escapeHtml(answerInput.value)}"不对哦。正确答案是："${escapeHtml(currentSelectedBubble.answer)}"。再复习一下！`;
    modalFeedback.style.color = "var(--c2)";
    answerInput.value = "";
    answerInput.focus();
  }
}

function closeModal() {
  modal.style.display = "none";
  currentSelectedBubble = null;
  modalFeedback.innerHTML = "";
}

function resetGame() {
  activeBubbles = KNOWLEDGE_BUBBLES.map((b) => ({ ...b }));
  currentScore = 0;
  closeModal();
  updateUI();
}

function init() {
  resetGame();

  resetBtn.addEventListener("click", resetGame);

  submitBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentSelectedBubble) handleAnswerSubmission();
    else closeModal();
  });

  closeModalBtn.addEventListener("click", closeModal);

  answerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentSelectedBubble) handleAnswerSubmission();
    }
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

init();
