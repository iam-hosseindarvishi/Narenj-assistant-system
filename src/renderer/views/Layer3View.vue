<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card title="لایه ۳: تطبیق تراکنش‌های بانکی غیر POS با اسناد حسابداری">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="3">
                <v-card color="primary" variant="tonal">
                  <v-card-title>تطبیق‌یافته</v-card-title>
                  <v-card-text class="text-h5 font-weight-bold">{{ stats.matched }}</v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="3">
                <v-card color="warning" variant="tonal">
                  <v-card-title>پیشنهادها</v-card-title>
                  <v-card-text class="text-h5 font-weight-bold">{{ stats.pending }}</v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="3">
                <v-card color="error" variant="tonal">
                  <v-card-title>تطبیق‌نیافته</v-card-title>
                  <v-card-text class="text-h5 font-weight-bold">{{ stats.unmatched }}</v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="3" class="d-flex align-center">
                <v-btn color="primary" block @click="runReconciliation">اجرای تطبیق لایه ۳</v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const stats = ref({
  matched: 0,
  pending: 0,
  unmatched: 0
})

const runReconciliation = () => {
  // Triggered via IPC in full app
}
</script>
