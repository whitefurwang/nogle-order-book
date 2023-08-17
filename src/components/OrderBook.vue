<script setup>
import { ref, reactive, watch, onBeforeUnmount, computed } from 'vue'
import Socket from '../utils/socket';
import formatNumber from '../utils/formatNumber';

const asks = reactive(new Map())
const bids = reactive(new Map())
const flashAskRows = ref(Array(8).fill(false))
const flashBidRows = ref(Array(8).fill(false))
const flashAskPrices = ref(Array(8).fill(0))
const flashBidPrices = ref(Array(8).fill(0))
const lastPrice = ref(null)
const lastPriceRow = ref(null)

function setData(data, payload) {
  payload.forEach(val => {
    if (val[1] == 0) return
    data.set(...val.map(Number))
  })
}

const orderBookSocket = new Socket('wss://ws.btse.com/ws/oss/futures', {
  request: {
    op: 'subscribe',
    args: ['update:BTCPFC'],
  },
  onMessage: (data) => {
    if (!data) return
    setData(asks, data.asks);
    setData(bids, data.bids);
  },
});

const lastPriceSocket = new Socket('wss://ws.btse.com/ws/futures', {
  request: {
    op: 'subscribe',
    args: ['tradeHistoryApi:BTCPFC'],
  },
  onMessage: (data) => {
    if (!data) return
    lastPrice.value = data[0];
  },
});

const askRows = computed(() => {
  const array = [...asks].sort((a, b) => a[0] - b[0])
  return array.reduce((acc, cur) => {
    if (
      acc.length >= 8 ||
      lastPrice.value?.price >= cur[0]
    ) {
      return acc
    }
    if (!acc.length) {
      acc.push([...cur, cur[1]])
    } else {
      acc.push([...cur, acc[acc.length - 1][2] + cur[1]])
    }
    return acc
  }, []).reverse()
})

const askBars = computed(() => {
  if (!askRows.value.length) return []
  return askRows.value.map(ask => (ask[2] / askRows.value[0][2]))
})

watch(askRows, (newAsks, oldAsks) => {
  Object.values(newAsks).forEach(([price, size], index) => {
    const oldAsk = oldAsks.find(([oldPrice]) => oldPrice === price)

    const isNewPrice = !oldAsks.length ? false : !oldAsk
    flashAskRows.value.splice(index, 1, isNewPrice)
    if (isNewPrice) {
      setTimeout(() => {
        flashAskRows.value.splice(index, 1, false)
      }, 150)
    }

    if (oldAsk && oldAsk[1] !== size) {
      flashAskPrices.value.splice(index, 1, size > oldAsk[1] ? 1 : -1)
      setTimeout(() => {
        flashAskPrices.value.splice(index, 1, 0)
      }, 150)
    }
  })
})

const bidRows = computed(() => {
  const array = [...bids].sort((a, b) => b[0] - a[0])
  return array.reduce((acc, cur) => {
    if (
      acc.length >= 8 ||
      lastPrice.value?.price <= cur[0]
    ) {
      return acc
    }
    if (!acc.length) {
      acc.push([...cur, cur[1]])
    } else {
      acc.push([...cur, acc[acc.length - 1][2] + cur[1]])
    }
    return acc
  }, [])
})

const bidBars = computed(() => {
  if (!bidRows.value.length) return []
  return bidRows.value.map(bid => (bid[2] / bidRows.value[7][2]))
}) 

watch(bidRows, (newBids, oldBids) => {
  Object.values(newBids).forEach(([price, size], index) => {
    const oldBid = oldBids.find(([oldPrice]) => oldPrice === price)

    const isNewPrice = !oldBids.length ? false : !oldBid
    flashBidRows.value.splice(index, 1, isNewPrice)
    if (isNewPrice) {
      setTimeout(() => {
        flashBidRows.value.splice(index, 1, false)
      }, 150)
    }

    if (oldBid && oldBid[1] !== size) {
      flashBidPrices.value.splice(index, 1, size > oldBid[1] ? 1 : -1)
      setTimeout(() => {
        flashBidPrices.value.splice(index, 1, 0)
      }, 150)
    }
  })
})

watch(lastPrice, (value, oldValue) => {
  let trend = ''

  if (!oldValue || value.price === oldValue.price) {
    trend = ''
  } else if (value.price > oldValue.price) {
    trend = '↑'
  } else {
    trend = '↓'
  }

  lastPriceRow.value = { ...value, trend }
})

onBeforeUnmount(() => {
  orderBookSocket.close()
  lastPriceSocket.close()
})
</script>

<template>
  <table>
    <thead>
      <tr>
        <th colspan="3" class="text-left text-white font-bold">Order Book</th>
      </tr>
      <tr>
        <th class="text-left">Price (USD)</th>
        <th class="text-right">Size</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="([price, size, total], index) in askRows"
        :key="`ask-${index}`"
        :class="flashAskRows[index] ? 'flash-bg-red' : null"
      >
        <td class="text-left text-red">{{ formatNumber(price, { decimal: true }) }}</td>
        <td
          class="text-right"
          :class="flashAskPrices[index] ? {
            'flash-bg-green': flashAskPrices[index] === 1,
            'flash-bg-red': flashAskPrices[index] === -1,
          } : null"
        >{{ formatNumber(size) }}</td>
        <td>
          <div
            class="bar bg-red"
            :style="`--data-total: ${askBars[index] * 100}%`"
          >
            <span>
              {{ formatNumber(total) }}
            </span>
          </div>
        </td>
      </tr>
      <tr>
        <td
          colspan="3"
          class="last-price text-center font-bold"
          :class="lastPriceRow ? {
            'text-green bg-green': lastPriceRow.trend === '↑',
            'text-red bg-red': lastPriceRow.trend === '↓',
          } : null"
        >{{
          !lastPriceRow
            ? ''
            : `${formatNumber(lastPriceRow.price, { decimal: true })} ${lastPriceRow.trend}`
        }}</td>
      </tr>
      <tr
        v-for="([price, size, total], index) in bidRows"
        :key="`bid-${index}`"
      >
        <td class="text-left text-green">{{ formatNumber(price, { decimal: true }) }}</td>
        <td
          class="text-right"
          :class="flashBidPrices[index] ? {
            'flash-bg-green': flashBidPrices[index] === 1,
            'flash-bg-red': flashBidPrices[index] === -1,
          } : null"
        >{{ formatNumber(size) }}</td>
        <td>
          <div
            class="bar bg-green"
            :style="`--data-total: ${bidBars[index] * 100}%`"
          >
            <span>
              {{ formatNumber(total) }}
            </span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
table {
  background-color: #131B29;
  color: #F0F4F8;
  width: 100%;
  max-width: 600px;
  border-spacing: 0;
  margin: 0 auto;
}
th,
td {
  padding: 1px 8px;
}
th {
  color: #8698aa;
}
th:nth-child(2) {
  width: 30%;
}
th:nth-child(3) {
  width: 35%;
}
tr,
td {
  transition: background-color 150ms ease-in-out;
}
tr:hover td:not(.bg-green, .bg-red) {
  background-color: #1E3059;
}
.last-price {
  font-size: 16px;
  line-height: 30px;
}
.font-bold {
  font-weight: bold;
}
.text-white {
  color: #F0F4F8;
}
.text-left {
  text-align: left;
}
.text-right {
  text-align: right;
}
.text-center {
  text-align: center;
}
.text-red {
  color: #FF5B5A;
}
.text-green {
  color: #00b15d;
}
.bar {
  float: right;
  width: var(--data-total);
  white-space: nowrap;
}
.bar span {
  float: right;
}
.bg-red {
  background-color: rgba(255, 90, 90, 0.12);
}
.bg-green {
  background-color: rgba(16, 186, 104, 0.12);
}
.flash-bg-red {
  background-color: rgba(255, 91, 90, 0.5);
}
.flash-bg-green {
  background-color: rgba(0, 177, 93, 0.5);
}
</style>
