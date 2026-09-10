<template>
  <v-container fluid dir="rtl">
    <h1 class="text-h5 mb-4">مغایرت‌یابی خودکار</h1>

    <v-stepper v-model="currentStep" :items="steps" flat>
      <template #item.1>
        <LayerStep1 :active="currentStep === 1" @done="markDone(0)" />
      </template>
      <template #item.2>
        <LayerStep2 :active="currentStep === 2" @done="markDone(1)" />
      </template>
      <template #item.3>
        <LayerStep3 :active="currentStep === 3" @done="markDone(2)" />
      </template>
      <template #item.4>
        <LayerStep4 :active="currentStep === 4" @done="markDone(3)" />
      </template>

      <template #actions>
        <v-card flat class="d-flex justify-space-between pa-4">
          <v-btn v-if="currentStep > 1" variant="tonal" @click="currentStep--">مرحله قبل</v-btn>
          <v-spacer v-else />
          <v-btn v-if="currentStep < 4" color="primary" :disabled="!stepDone[currentStep - 1]" @click="currentStep++">مرحله بعد</v-btn>
        </v-card>
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
</script>
