import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // validando customer
    const customerValidated = await this.customersRepository.findById(
      customer_id,
    );

    if (!customerValidated) {
      throw new AppError('Custormer not exists');
    }

    // validando products
    const productIds = products.map(product => {
      return { id: product.id };
    });
    const productsValidated = await this.productsRepository.findAllById(
      productIds,
    );

    if (productsValidated.length < products.length) {
      throw new AppError('There are invalids products in your order');
    }

    // validando as quantidades em estoque dos produtos
    const productsStock = productsValidated.map(prodValidated => {
      const prodOrder = products.find(prod => prod.id === prodValidated.id);

      return {
        id: prodValidated.id,
        quantity: prodValidated.quantity - (prodOrder?.quantity || 0),
      };
    });

    if (productsStock.find(prod => prod.quantity < 0)) {
      throw new AppError('There are products with insuficient stock');
    }

    const productsOrder = productsValidated.map(prodValidated => {
      const prodOrder = products.find(prod => prod.id === prodValidated.id);

      return {
        product_id: prodValidated.id,
        price: prodValidated.price,
        quantity: prodOrder?.quantity || 0,
      };
    });

    const order = await this.ordersRepository.create({
      customer: customerValidated,
      products: productsOrder,
    });

    // Atualizando as quantidades
    await this.productsRepository.updateQuantity(productsStock);

    return order;
  }
}

export default CreateProductService;
