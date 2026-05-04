import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreatePlanDto, CreateSubscriptionDto } from './dto';
import { SubscriptionService } from './subscription.service';

@Controller()
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get('plans')
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @Post('plans')
  createPlan(@Body() body: CreatePlanDto) {
    return this.subscriptions.createPlan(body);
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.subscriptions.listSubscriptions();
  }

  @Post('subscriptions')
  createSubscription(@Body() body: CreateSubscriptionDto) {
    return this.subscriptions.createSubscription(body);
  }
}
