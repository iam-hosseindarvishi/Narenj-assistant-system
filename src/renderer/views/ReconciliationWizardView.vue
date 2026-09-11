<template>
  <v-container fluid dir="rtl" class="pa-0">
    <h1 class="text-h5 mb-4 px-4">مغایرت‌یابی خودکار</h1>

    <v-stepper v-model="currentStep" :items="steps" flat>
      <template #item.1>
        <LayerStep1 :active="currentStep === 1" @done="markDone(0)" @next="goNext" />
      </template>
      <template #item.2>
        <LayerStep2 :active="currentStep === 2" @done="markDone(1)" @next="goNext" />
      </template>
      <template #item.3>
        <LayerStep3 :active="currentStep === 3" @done="markDone(2)" @next="goNext" />
      </template>
      <template #item.4>
        <LayerStep4 :active="currentStep === 4" @done="markDone(3)" />
      </template>
    </v-stepper>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LayerStep1 from './wizard/LayerStep1.vue'
import LayerStep2 from './wizard/LayerStep2.vue'
import LayerStep3 from './wizard/LayerStep3.vue'
import LayerStep4 from './wizard/LayerStep4.vue'

const currentStep = ref(1)
const steps = [
  { title: 'مغایرت پوز–بانک', value: 1 },
  { title: 'کارمزدها', value: 2 },
  { title: 'بانک–حسابداری', value: 3 },
  { title: 'ریز پوز', value: 4 }
]

const stepDone = ref([false, false, false, false])

function markDone(index: number): void {
  stepDone.value[index] = true
}

function goNext(): void {
  if (currentStep.value < 4) currentStep.value++
}
</script>
